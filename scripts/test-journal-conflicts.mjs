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
const email = `conflict-test-${randomUUID()}@example.invalid`;
try {
  const registered = await context.request.post(origin + "/api/auth/signup", {
    headers: { Origin: origin },
    data: { name: "Conflict Test", email, password: "JournalConflict123!" },
  });
  assert.equal(registered.status(), 200);
  const { user } = await registered.json();
  const page = await context.newPage();
  async function create() {
    const id = randomUUID();
    const response = await context.request.post(origin + "/api/journal/sync", {
      headers: { Origin: origin, "X-Local-Journal-Owner": user.id },
      data: {
        key: randomUUID(),
        entryId: id,
        kind: "create",
        values: { content: "Original", moodScore: 5 },
      },
    });
    assert.equal(response.status(), 200);
    return id;
  }
  async function remoteChange(id, content) {
    const row = await db.journalEntry.findUnique({ where: { id } });
    await db.journalEntry.update({
      where: { id },
      data: { content, updatedAt: new Date(Math.max(Date.now(), +row.updatedAt + 1)) },
    });
  }
  const conflict = () => page.getByRole("region", { name: "Resolve journal conflict" });
  async function offlineEdit(id, content) {
    await page.goto(origin + `/journal/${id}/edit`);
    await page.getByLabel("Your reflection", { exact: true }).fill(content);
    await context.setOffline(true);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page
      .getByText("Changes saved on this device and queued for sync.", { exact: false })
      .waitFor();
  }
  async function choose(name) {
    page.once("dialog", (dialog) => dialog.accept());
    await conflict().getByRole("button", { name, exact: true }).click();
  }
  const id = await create();
  await offlineEdit(id, "First local edit");
  await page.getByRole("button", { name: "Edit local entry", exact: true }).click();
  await page.getByLabel("Your reflection", { exact: true }).fill("Latest local edit");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await remoteChange(id, "Remote edit");
  await context.setOffline(false);
  await conflict().getByRole("button", { name: "Review conflict" }).click();
  await conflict().getByText("Latest local edit", { exact: true }).waitFor();
  await conflict().getByText("Remote edit", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Retry sync", exact: true }).count(), 0);
  await page.reload();
  await conflict().getByRole("button", { name: "Review conflict" }).click();
  await conflict().getByText("Remote edit", { exact: true }).waitFor();
  await remoteChange(id, "Remote changed during review");
  await choose("Keep my version");
  await conflict().getByText("The server changed again.", { exact: false }).waitFor();
  assert.equal(
    (await db.journalEntry.findUnique({ where: { id } })).content,
    "Remote changed during review"
  );
  await conflict().getByRole("button", { name: "Reload comparison" }).click();
  await conflict().getByText("Remote changed during review", { exact: true }).waitFor();
  await choose("Keep my version");
  await page.getByText("Synced — saved to your journal.", { exact: true }).waitFor();
  assert.equal((await db.journalEntry.findUnique({ where: { id } })).content, "Latest local edit");
  const rows = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("vibejournal-local-drafts");
        open.onsuccess = () => {
          const read = open.result.transaction("mutations").objectStore("mutations").getAll();
          read.onsuccess = () => {
            open.result.close();
            resolve(read.result);
          };
        };
      })
  );
  const edits = rows.filter((row) => row.entryId === id);
  assert.equal(edits.filter((row) => row.status === "discarded").length, 2);
  assert.equal(edits.filter((row) => row.status === "synced").length, 1);
  assert.equal(
    new Set(edits.map((row) => row.key)).size,
    3,
    "resolution gets a fresh idempotency key"
  );

  const serverId = await create();
  await offlineEdit(serverId, "Discard this local edit");
  await remoteChange(serverId, "Keep this server edit");
  await context.setOffline(false);
  await conflict().getByRole("button", { name: "Review conflict" }).click();
  await conflict().getByText("Keep this server edit", { exact: true }).waitFor();
  await choose("Keep server version");
  await page.waitForURL(origin + `/journal/${serverId}`);
  assert.equal(
    (await db.journalEntry.findUnique({ where: { id: serverId } })).content,
    "Keep this server edit"
  );

  const deleteId = await create();
  await page.goto(origin + `/journal/${deleteId}`);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Delete entry", exact: true }).click();
  await page.getByRole("button", { name: "Permanently delete entry", exact: true }).click();
  await page.getByText("Deletion saved locally", { exact: false }).waitFor();
  await remoteChange(deleteId, "Do not silently delete this update");
  await context.setOffline(false);
  await conflict().getByRole("button", { name: "Review conflict" }).click();
  await conflict().getByText("Do not silently delete this update", { exact: true }).waitFor();
  await choose("Keep server version");
  await page.waitForURL(origin + `/journal/${deleteId}`);
  assert.ok(await db.journalEntry.findUnique({ where: { id: deleteId } }));

  const missingId = await create();
  await offlineEdit(missingId, "Recover after remote deletion");
  await db.journalEntry.delete({ where: { id: missingId } });
  await context.setOffline(false);
  await conflict().getByRole("button", { name: "Review conflict" }).click();
  await conflict().getByText("This entry no longer exists", { exact: false }).waitFor();
  await choose("Save local version as new entry");
  await page.waitForURL(origin + "/journal?deleted=1");
  await page.waitForFunction(() =>
    [...document.querySelectorAll("article")].some(
      (article) =>
        article.textContent.includes("Recover after remote deletion") &&
        article.textContent.includes("Synced — saved to your journal.")
    )
  );
  const recovered = await db.journalEntry.findFirst({
    where: { userId: user.id, content: "Recover after remote deletion" },
  });
  assert.ok(recovered);
  assert.notEqual(recovered.id, missingId);
  assert.equal(await db.journalEntry.findUnique({ where: { id: missingId } }), null);
  console.log(
    "PASS: explicit persistent conflict state, pause/reload, two-version comparison, repeated remote changes, keep-local with fresh key, keep-server, delete conflict and recovery as a new entry."
  );
} finally {
  await browser.close();
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
}
