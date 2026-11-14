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
const email = `offline-test-${randomUUID()}@example.invalid`;
try {
  const registered = await context.request.post(origin + "/api/auth/signup", {
    headers: { Origin: origin },
    data: { name: "Offline Test", email, password: "OfflineTest123!" },
  });
  assert.equal(registered.status(), 200);
  const { user } = await registered.json();
  let page = await context.newPage();
  await page.goto(origin + "/journal/new");
  await page.getByLabel("Your reflection", { exact: true }).fill("Created without a connection");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await page.getByText("Pending — saved on this device only.", { exact: true }).waitFor();
  assert.equal(await db.journalEntry.count({ where: { userId: user.id } }), 0);
  const localRows = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open("vibejournal-local-drafts");
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const req = open.result
              .transaction("localEntries")
              .objectStore("localEntries")
              .getAll();
            req.onsuccess = () => {
              resolve(req.result);
              open.result.close();
            };
          };
        })
    );
  const [local] = await localRows();
  assert.match(local.id, /^[0-9a-f-]{36}$/);
  assert.equal(local.status, "pending");
  await page.close();
  // Reopen the app online, simulating a lost response AFTER the server commits.
  await context.setOffline(false);
  page = await context.newPage();
  await page.route("**/api/journal", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.abort("failed");
  });
  await page.goto(origin + "/journal/new");
  await page.getByText("Failed to sync — saved on this device only.", { exact: true }).waitFor();
  assert.equal(await db.journalEntry.count({ where: { userId: user.id } }), 1);
  assert.equal((await localRows())[0].id, local.id);
  await page.unroute("**/api/journal");
  await page.getByRole("button", { name: "Retry sync", exact: true }).click();
  await page.getByText("Synced — saved to your journal.", { exact: true }).waitFor();
  assert.equal(
    await db.journalEntry.count({ where: { userId: user.id } }),
    1,
    "ambiguous response retry is idempotent"
  );
  assert.equal(
    (await db.journalEntry.findUnique({ where: { id: local.id } })).content,
    local.values.content
  );
  const payload = { ...local.values, clientEntryId: local.id };
  const repeated = await Promise.all(
    Array.from({ length: 4 }, () =>
      context.request.post(origin + "/api/journal", {
        headers: { Origin: origin, "X-Local-Journal-Owner": user.id },
        data: payload,
      })
    )
  );
  assert.ok(repeated.every((response) => response.status() === 201));
  assert.equal(await db.journalEntry.count({ where: { userId: user.id } }), 1);
  const wrongOwner = await context.request.post(origin + "/api/journal", {
    headers: { Origin: origin, "X-Local-Journal-Owner": "different-account" },
    data: { ...payload, clientEntryId: randomUUID() },
  });
  assert.equal(wrongOwner.status(), 403);
  // Recover an expired upload lease after a crashed tab.
  await page.evaluate(
    (id) =>
      new Promise((resolve) => {
        const open = indexedDB.open("vibejournal-local-drafts");
        open.onsuccess = () => {
          const tx = open.result.transaction("localEntries", "readwrite");
          const store = tx.objectStore("localEntries");
          const req = store.get(id);
          req.onsuccess = () =>
            store.put({
              ...req.result,
              status: "syncing",
              leaseUntil: Date.now() - 1,
              attempt: "crashed-tab",
            });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    local.id
  );
  await page.reload();
  await page.getByText("Synced — saved to your journal.", { exact: true }).waitFor();
  assert.equal(await db.journalEntry.count({ where: { userId: user.id } }), 1);
  const concurrentId = randomUUID();
  const concurrentCreates = await Promise.all(
    Array.from({ length: 4 }, () =>
      context.request.post(origin + "/api/journal", {
        headers: { Origin: origin, "X-Local-Journal-Owner": user.id },
        data: { content: "Concurrent create", moodScore: 6, clientEntryId: concurrentId },
      })
    )
  );
  assert.ok(concurrentCreates.every((response) => response.status() === 201));
  assert.equal(
    await db.journalEntry.count({ where: { id: concurrentId, userId: user.id } }),
    1,
    "simultaneous first uploads commit exactly once"
  );
  console.log(
    "PASS: offline local commit, stable IDs, tab-close retention, reconnect upload, lost-response retry, concurrent idempotency, owner guard and expired lease recovery."
  );
} finally {
  await browser.close();
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
}
