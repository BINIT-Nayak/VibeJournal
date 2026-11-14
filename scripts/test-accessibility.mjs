import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const email = "a11y-" + randomUUID() + "@example.invalid";
const results = [];
async function visit(route) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(origin + route, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      if (attempt === 2 || !String(error).includes("ERR_ABORTED")) throw error;
    }
  }
}
async function scan(name) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    });
    return result.violations.map((rule) => ({
      id: rule.id,
      impact: rule.impact,
      help: rule.help,
      nodes: rule.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    }));
  });
  results.push({ name, violations });
  writeFileSync("/tmp/vibejournal-accessibility.json", JSON.stringify(results, null, 2));
  console.log(
    name + ": " + violations.map((rule) => rule.id + "(" + rule.nodes.length + ")").join(", ")
  );
}
try {
  for (const route of ["/login", "/register", "/forgot-password"]) {
    await visit(route);
    await page.locator("h1").waitFor();
    await scan(route);
  }
  const registered = await context.request.post(origin + "/api/auth/signup", {
    headers: { Origin: origin },
    data: { email, password: "AccessibleTest123!", name: "Accessibility test" },
  });
  assert.equal(registered.status(), 200);
  await registered.json();
  const saved = await context.request.post(origin + "/api/journal", {
    headers: { Origin: origin },
    data: {
      title: "Test reflection",
      content: "Test journal for accessibility verification.",
      moodScore: 7,
      energyScore: 6,
      tags: ["reflection"],
    },
  });
  assert.equal(saved.status(), 201);
  const { entry } = await saved.json();
  for (const route of [
    "/dashboard",
    "/journal",
    "/journal/new",
    "/journal/" + entry.id,
    "/journal/" + entry.id + "/edit",
    "/analytics",
    "/music",
    "/dashboard#profile",
  ]) {
    await visit(route);
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(700);
    await scan(route.replace(entry.id, "[id]"));
  }
  await page.getByRole("button", { name: "Delete account permanently", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Current password", { exact: true }).waitFor();
  await scan("account deletion dialog");
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press("Tab");
    assert.ok(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.contains(document.activeElement)),
      "focus stays within modal"
    );
  }
  await page.keyboard.press("Escape");
  assert.ok(
    await page
      .getByRole("button", { name: "Delete account permanently", exact: true })
      .evaluate((element) => element === document.activeElement),
    "dialog returns focus"
  );
  await page.getByRole("button", { name: /Theme: Light/ }).click();
  await page.waitForTimeout(500);
  await scan("settings dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await scan("settings mobile dark");
  await page.getByRole("button", { name: /Theme: Dark/ }).click();
  await visit("/journal/new");
  await page.getByRole("radio", { name: "5 out of 10 — Neutral" }).waitFor();
  await scan("editor mobile");
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    "editor reflows without horizontal page scrolling"
  );
  const neutral = page.getByRole("radio", { name: "5 out of 10 — Neutral" });
  await page.waitForFunction(() => {
    const radio = document.querySelector('input[type="radio"][value="5"]');
    return radio && !radio.matches(":disabled");
  });
  await neutral.focus();
  await page.keyboard.press("ArrowRight");
  await page.locator('input[type="radio"][value="6"]:checked').waitFor();
  assert.ok(
    await page.getByRole("radio", { name: "6 out of 10 — Okay" }).isChecked(),
    "arrow keys change numeric mood"
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("type")),
    "range",
    "radio group uses one tab stop"
  );
  const energy = page.getByRole("slider", { name: "Energy slider" });
  assert.match(await energy.getAttribute("aria-valuetext"), /Not recorded/);
  await page.keyboard.press("ArrowRight");
  await page.locator('input[type="range"][aria-valuetext="6 out of 10"]').waitFor();
  assert.equal(await energy.getAttribute("aria-valuetext"), "6 out of 10");
  await page.getByLabel("Your reflection", { exact: true }).focus();
  await page.keyboard.press("Control+Enter");
  await page.locator('textarea[aria-invalid="true"]').waitFor();
  await page.waitForFunction(
    () =>
      document.activeElement?.tagName === "TEXTAREA" &&
      document.activeElement.getAttribute("aria-invalid") === "true"
  );
  assert.ok(
    await page
      .getByLabel("Your reflection", { exact: true })
      .evaluate((element) => element === document.activeElement),
    "invalid form focuses reflection"
  );
  await scan("editor validation errors");
  await page.setViewportSize({ width: 1280, height: 900 });
  await visit("/dashboard");
  await page.locator("summary").filter({ hasText: "View mood values as a table" }).waitFor();
  const tableToggle = page.locator("summary").filter({ hasText: "View mood values as a table" });
  await tableToggle.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("table", { name: /7-day mood history/ }).waitFor();
  assert.equal(
    await page
      .getByRole("table", { name: /7-day mood history/ })
      .locator("tbody tr")
      .count(),
    7
  );
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main-content");

  writeFileSync("/tmp/vibejournal-accessibility.json", JSON.stringify(results, null, 2));
  if (!process.env.A11Y_BASELINE)
    assert.equal(
      results.flatMap((result) => result.violations).length,
      0,
      "Accessibility violations; see /tmp/vibejournal-accessibility.json"
    );
  console.log("Accessibility report saved; " + results.length + " page/state checks.");
} finally {
  await browser.close();
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
}
