import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const email = `draft-test-${randomUUID()}@example.invalid`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const emails = [email];
try {
  const response = await context.request.post(origin + "/api/auth/signup", {
    headers: { Origin: origin },
    data: { name: "Draft Test", email, password: "LocalDraftTest123!" },
  });
  assert.equal(response.status(), 200, await response.text());
  let page = await context.newPage();
  await page.goto(origin + "/journal/new");
  const content = () => page.getByLabel("Your reflection", { exact: true });
  await content().fill("A private unfinished reflection");
  await page.getByLabel("Title", { exact: false }).fill("Draft title");
  await page.getByPlaceholder("gratitude, work, rest").fill("rest, unfinished");
  await page.getByText("Draft saved on this device.", { exact: false }).waitFor();
  await page.reload();
  await page.getByText("Local draft restored from this browser.").waitFor();
  assert.equal(await content().inputValue(), "A private unfinished reflection");
  assert.equal(
    await page.getByPlaceholder("gratitude, work, rest").inputValue(),
    "rest, unfinished"
  );
  await page.close();
  page = await context.newPage();
  await page.goto(origin + "/journal/new");
  await page.getByText("Local draft restored from this browser.").waitFor();
  assert.equal(await content().inputValue(), "A private unfinished reflection");
  await page.route("**/api/journal/sync", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "TEST_FAILURE", message: "Test save failure" } }),
    })
  );
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await page.getByText("Test save failure", { exact: false }).waitFor();
  await page.reload();
  await page.getByText("Failed to sync — saved on this device only.").waitFor();
  await page.unroute("**/api/journal/sync");
  await page.getByRole("button", { name: "Retry sync", exact: true }).click();
  await page.getByText("Synced — saved to your journal.").waitFor();
  const entryId = (await page.getByRole("link", { name: "View saved entry" }).getAttribute("href"))
    .split("/")
    .pop();
  await page.goto(origin + "/journal/new");
  await page.getByText("Changes are saved locally", { exact: false }).waitFor();
  assert.equal(await content().inputValue(), "");
  await page.goto(origin + `/journal/${entryId}/edit`);
  await content().fill("Edited local draft");
  await page.getByText("Draft saved on this device.", { exact: false }).waitFor();
  await page.reload();
  await page.getByText("Local draft restored from this browser.").waitFor();
  assert.equal(await content().inputValue(), "Edited local draft");
  await db.journalEntry.update({
    where: { id: entryId },
    data: { content: "Concurrent server change", updatedAt: new Date(Date.now() + 1000) },
  });
  await page.reload();
  await page.getByText("The saved entry has changed", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Conflict — review required before syncing.", { exact: true }).waitFor();
  assert.equal(
    (await db.journalEntry.findUnique({ where: { id: entryId } })).content,
    "Concurrent server change"
  );
  await page.goto(origin + "/journal/new");
  await content().fill("Only the first account should see this draft");
  await page.getByText("Draft saved on this device.", { exact: false }).waitFor();
  const email2 = `draft-test-${randomUUID()}@example.invalid`;
  emails.push(email2);
  await context.request.post(origin + "/api/auth/logout", {
    headers: { Origin: origin },
    data: {},
  });
  const second = await context.request.post(origin + "/api/auth/signup", {
    headers: { Origin: origin },
    data: { name: "Second Account", email: email2, password: "LocalDraftTest123!" },
  });
  assert.equal(second.status(), 200);
  await page.close();
  page = await context.newPage();
  await page.goto(origin + "/journal/new");
  await page.getByText("Changes are saved locally", { exact: false }).waitFor();
  assert.equal(await content().inputValue(), "", "account isolation within same browser storage");
  const blockedStorage = await browser.newContext();
  await blockedStorage.addCookies(await context.cookies());
  await blockedStorage.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("Storage disabled");
      },
    });
  });
  const blockedPage = await blockedStorage.newPage();
  await blockedPage.goto(origin + "/journal/new");
  await blockedPage.getByText("Local draft storage is unavailable.", { exact: false }).waitFor();
  await blockedPage.getByLabel("Your reflection", { exact: true }).fill("Still able to write");
  await blockedPage.getByRole("button", { name: "Save entry", exact: true }).click();
  await blockedPage.waitForURL(/\/journal\/[^/]+\?created=1/);
  await blockedStorage.close();
  console.log(
    "PASS: refresh/tab-close recovery, tags, failed-save retention, successful-save cleanup, edit recovery, stale-update rejection, explicit discard, account isolation and unavailable-storage save fallback."
  );
} finally {
  await browser.close();
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.$disconnect();
}
