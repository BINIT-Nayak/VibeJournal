import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const email = "delete-browser-" + randomUUID() + "@example.invalid";
const password = randomUUID();
let stage = "setup";
try {
  const response = await context.request.post(origin + "/api/auth/signup", {
    headers: { Origin: origin },
    data: { email, password, name: "Deletion test" },
  });
  assert.equal(response.status(), 200);
  const { user } = await response.json();
  const page = await context.newPage();
  await page.goto(origin + "/journal/new");
  await page.getByLabel("Your reflection", { exact: true }).fill("Local private draft");
  await page
    .getByText("Draft saved on this device. Not yet saved to your journal.", { exact: true })
    .waitFor();
  await page.evaluate(async (userId) => {
    await new Promise((resolve, reject) => {
      const open = indexedDB.open("vibejournal-local-drafts");
      open.onerror = () => reject();
      open.onsuccess = () => {
        const database = open.result;
        const tx = database.transaction(["drafts", "localEntries", "mutations"], "readwrite");
        tx.objectStore("drafts").put({
          key: "other-user-draft",
          userId: "other-local-user",
          values: { content: "preserve", moodScore: 5 },
          savedAt: Date.now(),
        });
        tx.objectStore("localEntries").put({
          id: "deleted-local-entry",
          userId,
          values: { content: "remove", moodScore: 5 },
          status: "synced",
          createdAt: new Date().toISOString(),
        });
        tx.objectStore("mutations").add({
          key: crypto.randomUUID(),
          userId,
          entryId: "deleted-local-entry",
          kind: "create",
          status: "synced",
          attempts: 1,
          retryable: false,
          nextAttemptAt: 0,
        });
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject();
      };
    });
  }, user.id);
  await page.goto(origin + "/dashboard#profile");
  const second = await context.newPage();
  await second.goto(origin + "/journal");
  stage = "confirmation dialog";
  await page.getByRole("button", { name: "Delete account permanently", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Permanently delete your account?" });
  await dialog.getByLabel("Current password", { exact: true }).waitFor();
  assert.equal(
    await dialog.getByRole("button", { name: "Permanently delete my account" }).isDisabled(),
    true
  );
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), false);
  assert.equal(
    await page
      .getByRole("button", { name: "Delete account permanently", exact: true })
      .evaluate((element) => element === document.activeElement),
    true
  );
  await page.getByRole("button", { name: "Delete account permanently", exact: true }).click();
  await dialog.getByLabel("Current password", { exact: true }).fill("wrong-password");
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog.getByRole("button", { name: "Permanently delete my account" }).click();
  await dialog.getByRole("alert").filter({ hasText: "current password is incorrect" }).waitFor();
  assert.ok(await db.user.findUnique({ where: { id: user.id } }));
  stage = "successful deletion";
  await dialog.getByLabel("Current password", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Permanently delete my account" }).click();
  await page.waitForURL("**/login?accountDeleted=1");
  await second.waitForURL("**/login?accountDeleted=1");
  assert.equal(await db.user.count({ where: { id: user.id } }), 0);
  const rows = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("vibejournal-local-drafts");
        open.onerror = () => reject();
        open.onsuccess = () => {
          const database = open.result;
          const tx = database.transaction(["drafts", "localEntries", "mutations"]);
          const result = {};
          for (const name of ["drafts", "localEntries", "mutations"]) {
            const read = tx.objectStore(name).getAll();
            read.onsuccess = () => {
              result[name] = read.result;
            };
          }
          tx.oncomplete = () => {
            database.close();
            resolve(result);
          };
        };
      })
  );
  assert.equal(rows.drafts.length, 1);
  assert.equal(rows.drafts[0].userId, "other-local-user");
  assert.deepEqual(rows.localEntries, []);
  assert.deepEqual(rows.mutations, []);
  console.log(
    "PASS: accessible confirmation, Escape/focus return, password errors, deletion, scoped IndexedDB cleanup and cross-tab sign-out."
  );
} catch {
  console.error("Deletion browser test failed at", stage, "(private details suppressed).");
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
}
