import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const email = `sync-test-${randomUUID()}@example.invalid`;
try {
  const registration = await context.request.post(origin + "/api/auth/signup", {
    headers: { Origin: origin },
    data: { name: "Sync Test", email, password: "JournalSync123!" },
  });
  assert.equal(registration.status(), 200);
  const { user } = await registration.json();
  let page = await context.newPage();
  await page.goto(origin + "/journal/new");
  await page.getByLabel("Your reflection", { exact: true }).fill("Offline original");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await page.getByText("Pending — saved on this device only.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit local entry", exact: true }).click();
  await page.getByLabel("Your reflection", { exact: true }).fill("Offline edited");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Edit local entry", exact: true }).waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Queue deletion", exact: true }).click();
  await page.getByText("Deletion queued", { exact: false }).waitFor();
  const records = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("vibejournal-local-drafts");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const read = request.result.transaction("mutations").objectStore("mutations").getAll();
            read.onsuccess = () => {
              request.result.close();
              resolve(read.result);
            };
          };
        })
    );
  const queued = await records();
  assert.deepEqual(
    queued.map((row) => row.kind),
    ["create", "update", "delete"]
  );
  assert.equal(new Set(queued.map((row) => row.key)).size, 3);
  assert.equal(await db.journalEntry.count({ where: { userId: user.id } }), 0);
  // Simulate a tab dying during upload; the next runner must recover its lease.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("vibejournal-local-drafts");
        open.onsuccess = () => {
          const tx = open.result.transaction("mutations", "readwrite");
          const store = tx.objectStore("mutations");
          const cursor = store.openCursor();
          cursor.onsuccess = () =>
            cursor.result.update({
              ...cursor.result.value,
              status: "syncing",
              leaseUntil: Date.now() - 1,
              attempt: "closed-tab",
            });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      })
  );
  await page.close();
  await context.setOffline(false);
  page = await context.newPage();
  // Drop the first create response after the remote transaction commits.
  let dropped = false;
  await page.route("**/api/journal/sync", async (route) => {
    if (!dropped) {
      dropped = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await context.setOffline(false);
  await page.goto(origin + "/journal/new");
  await page.getByText("Failed to sync", { exact: false }).waitFor();
  assert.equal(await db.journalMutationReceipt.count({ where: { userId: user.id } }), 1);
  assert.equal(
    (await records())[1].status,
    "pending",
    "dependent operations wait for acknowledgement"
  );
  await page.getByRole("button", { name: "Retry sync", exact: true }).click();
  await page.getByText("Deletion synced.", { exact: true }).waitFor();
  assert.equal(await db.journalEntry.count({ where: { userId: user.id } }), 0);
  assert.equal(await db.journalMutationReceipt.count({ where: { userId: user.id } }), 3);
  const completed = await records();
  assert.ok(completed.every((row) => row.status === "synced"));
  assert.equal(completed[1].payload.expectedUpdatedAt, completed[0].result.updatedAt);
  assert.equal(completed[2].payload.expectedUpdatedAt, completed[1].result.updatedAt);
  const send = (payload, owner = user.id) =>
    context.request.post(origin + "/api/journal/sync", {
      headers: { Origin: origin, "X-Local-Journal-Owner": owner },
      data: payload,
    });
  for (const row of completed) {
    const replay = await send(row.payload);
    assert.equal(replay.status(), 200, await replay.text());
    assert.deepEqual((await replay.json()).result, row.result);
  }
  assert.equal(
    await db.journalEntry.count({ where: { userId: user.id } }),
    0,
    "replaying old create cannot resurrect deleted entry"
  );
  assert.equal(
    (
      await send({ ...completed[0].payload, values: { content: "Changed payload", moodScore: 5 } })
    ).status(),
    409
  );
  assert.equal((await send(completed[0].payload, "other-user")).status(), 403);
  const create = {
    key: randomUUID(),
    entryId: randomUUID(),
    kind: "create",
    values: { content: "Concurrent", moodScore: 5 },
  };
  const creates = await Promise.all(Array.from({ length: 4 }, () => send(create)));
  assert.ok(creates.every((response) => response.status() === 200));
  const original = (await creates[0].json()).result;
  const update = {
    key: randomUUID(),
    entryId: create.entryId,
    kind: "update",
    values: { content: "Updated once", moodScore: 7 },
    expectedUpdatedAt: original.updatedAt,
  };
  const updates = await Promise.all(Array.from({ length: 4 }, () => send(update)));
  assert.ok(updates.every((response) => response.status() === 200));
  const updated = (await updates[0].json()).result;
  assert.notEqual(updated.updatedAt, original.updatedAt);
  assert.equal(
    await db.journalMutationReceipt.count({ where: { userId: user.id, key: update.key } }),
    1
  );
  const stale = { ...update, key: randomUUID(), values: { content: "Stale", moodScore: 1 } };
  assert.equal((await send(stale)).status(), 409);
  assert.equal(
    await db.journalMutationReceipt.count({ where: { userId: user.id, key: stale.key } }),
    0,
    "failed mutation has no receipt"
  );
  assert.equal(
    (await db.journalEntry.findUnique({ where: { id: create.entryId } })).content,
    "Updated once"
  );
  // Exercise offline edit screen conflict preservation, not just the HTTP endpoint.
  await page.goto(origin + `/journal/${create.entryId}/edit`);
  await page.getByLabel("Your reflection", { exact: true }).fill("Preserved queued conflict");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByText("Changes saved on this device and queued for sync.", { exact: false })
    .waitFor();
  await db.journalEntry.update({
    where: { id: create.entryId },
    data: { content: "Newer remote content", updatedAt: new Date(Date.now() + 1000) },
  });
  await context.setOffline(false);
  await page.getByText("Conflict — review required before syncing.", { exact: true }).waitFor();
  const conflict = (await records()).find((row) => row.entryId === create.entryId);
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.retryable, false);
  assert.equal(conflict.values.content, "Preserved queued conflict");
  assert.equal(
    (await db.journalEntry.findUnique({ where: { id: create.entryId } })).content,
    "Newer remote content"
  );
  const uiEntry = {
    key: randomUUID(),
    entryId: randomUUID(),
    kind: "create",
    values: { content: "UI entry", moodScore: 5 },
  };
  assert.equal((await send(uiEntry)).status(), 200);
  await page.goto(origin + `/journal/${uiEntry.entryId}/edit`);
  await page.getByLabel("Your reflection", { exact: true }).fill("Updated through queued editor");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.waitForURL(origin + `/journal/${uiEntry.entryId}`);
  assert.equal(
    (await db.journalEntry.findUnique({ where: { id: uiEntry.entryId } })).content,
    "Updated through queued editor"
  );
  await context.setOffline(true);
  await page.getByRole("button", { name: "Delete entry", exact: true }).click();
  await page.getByRole("button", { name: "Permanently delete entry", exact: true }).click();
  await page.getByText("Deletion saved locally and queued for sync.", { exact: false }).waitFor();
  assert.ok(await db.journalEntry.findUnique({ where: { id: uiEntry.entryId } }));
  await context.setOffline(false);
  await page.waitForURL(origin + "/journal?deleted=1");
  assert.equal(await db.journalEntry.findUnique({ where: { id: uiEntry.entryId } }), null);
  // Upgrade version-2 create-only storage without losing drafts or pending work.
  const migrationContext = await browser.newContext();
  await migrationContext.addCookies(await context.cookies());
  const migrationPage = await migrationContext.newPage();
  await migrationPage.goto(origin + "/api/auth/me");
  const migratedId = randomUUID();
  await migrationPage.evaluate(
    ({ userId, id }) =>
      new Promise((resolve) => {
        const open = indexedDB.open("vibejournal-local-drafts", 20);
        open.onupgradeneeded = () => {
          const drafts = open.result.createObjectStore("drafts", { keyPath: "key" });
          drafts.createIndex("userId", "userId");
          const entries = open.result.createObjectStore("localEntries", { keyPath: "id" });
          entries.createIndex("userId", "userId");
          entries.createIndex("[userId+status]", ["userId", "status"]);
        };
        open.onsuccess = () => {
          const tx = open.result.transaction(["drafts", "localEntries"], "readwrite");
          tx.objectStore("drafts").put({
            key: JSON.stringify([userId, "new"]),
            userId,
            values: { content: "Retained migration draft", moodScore: 5 },
            savedAt: Date.now(),
          });
          tx.objectStore("localEntries").put({
            id,
            userId,
            values: { content: "Old pending create", moodScore: 5 },
            createdAt: new Date().toISOString(),
            status: "pending",
          });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    { userId: user.id, id: migratedId }
  );
  await migrationPage.goto(origin + "/journal/new");
  await migrationPage.getByText("Synced — saved to your journal.", { exact: true }).waitFor();
  assert.equal(
    await migrationPage.getByLabel("Your reflection", { exact: true }).inputValue(),
    "Retained migration draft"
  );
  assert.equal(await db.journalEntry.count({ where: { id: migratedId, userId: user.id } }), 1);
  await migrationContext.close();
  console.log(
    "PASS: ordered offline create/update/delete, stable keys, lost-response retry, atomic receipts, no resurrection, concurrent replay, owner guard, version chaining conflict preservation, tab-close recovery and version-2 migration."
  );
} finally {
  await browser.close();
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
}
