// Run after npm run build. Uses only a disposable account; no user content is logged.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const db = new PrismaClient();
const port = process.env.PROFILE_PORT || "3100";
const origin = `http://localhost:${port}`;
const events = [];
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", port], {
  env: { ...process.env, PROFILE_DATABASE: "1", REDIS_URL: "", AUTH_URL: origin },
  stdio: ["ignore", "pipe", "pipe"],
});
let buffer = "";
server.stdout.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines) {
    const index = line.indexOf("DB_PROFILE ");
    if (index >= 0) events.push(JSON.parse(line.slice(index + 11)));
  }
});
// Don't print server logs: failures can contain request details.
server.stderr.resume();
const email = `profile-${randomUUID()}@example.invalid`;
const report = { fixtureEntries: 90, serverRequests: [], pages: [], chart: [] };
let browser;
const summarize = (rows) => ({
  count: rows.length,
  dbMs: rows.reduce((n, e) => n + e.ms, 0),
  maxMs: Math.max(0, ...rows.map((e) => e.ms)),
  tables: rows.reduce((o, e) => ((o[e.table] = (o[e.table] || 0) + 1), o), {}),
});
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("Profiling server exited; check port/build configuration.");
    try {
      if ((await fetch(origin + "/login")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
    if (i === 99) throw new Error("Profiling server did not start");
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const auth = await browser.newContext();
  const signup = await auth.request.post(origin + "/api/auth/signup", {
    headers: { Origin: origin },
    data: { email, name: "Performance fixture", password: "ProfileFixture123!" },
  });
  assert.equal(signup.status(), 200);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const state = await auth.storageState();
  // No browser/prefetch during isolated SSR and API query measurements.
  for (const path of [
    "/dashboard",
    "/journal",
    "/api/dashboard?timeZone=UTC",
    "/api/analytics?days=90",
  ]) {
    for (let run = 0; run < 3; run++) {
      const start = events.length;
      const t = performance.now();
      const response = await auth.request.get(origin + path);
      await response.body();
      assert.equal(response.status(), 200);
      await new Promise((r) => setTimeout(r, 30));
      report.serverRequests.push({
        path,
        run,
        wallMs: Math.round(performance.now() - t - 30),
        ...summarize(events.slice(start)),
      });
    }
  }
  // Synthetic structured-only rows exercise aggregation without weakening production key access.
  await db.journalEntry.createMany({
    data: Array.from({ length: 90 }, (_, i) => ({
      userId: user.id,
      content: "",
      privatePayload: "e1.synthetic-analytics-only",
      contentRevision: 1,
      moodScore: 1 + (i % 10),
      energyScore: 1 + (i % 10),
      sleepHours: 6 + (i % 3),
      exercised: i % 2 === 0,
      legacyTags: [],
      createdAt: new Date(Date.now() - i * 86400000),
    })),
  });
  const analyticsFixtures = {};
  for (const days of [7, 30, 90]) {
    for (let run = 0; run < 3; run++) {
      const start = events.length;
      const t = performance.now();
      const response = await auth.request.get(origin + `/api/analytics?days=${days}`);
      assert.equal(response.status(), 200);
      analyticsFixtures[days] = await response.json();
      assert.ok(analyticsFixtures[days].statistics.journalCount > 0);
      await new Promise((r) => setTimeout(r, 30));
      report.serverRequests.push({
        path: `/api/analytics?days=${days}`,
        fixtureEntries: 90,
        run,
        wallMs: Math.round(performance.now() - t - 30),
        ...summarize(events.slice(start)),
      });
    }
  }
  await db.journalEntry.deleteMany({ where: { userId: user.id } });
  writeFileSync(
    process.env.PROFILE_OUTPUT || "/tmp/vibejournal-profile.json",
    JSON.stringify(report, null, 2)
  );
  for (const route of [
    "/dashboard",
    "/journal/new",
    "/analytics",
    "/dashboard#profile",
    "/music",
  ]) {
    for (let run = 0; run < 3; run++) {
      const context = await browser.newContext({ storageState: state });
      // Replay the measured synthetic analytics response so chart CPU is independent of DB/cache timing.
      await context.route("**/api/analytics?*", (route) => {
        const days = new URL(route.request().url()).searchParams.get("days");
        return route.fulfill({ json: analyticsFixtures[days] });
      });
      const page = await context.newPage();
      const calls = [];
      const warnings = [];
      page.on("request", (r) => {
        if (new URL(r.url()).pathname.startsWith("/api/"))
          calls.push(new URL(r.url()).pathname + new URL(r.url()).search);
      });
      page.on("console", (m) => {
        if (/width.*height|height.*width/i.test(m.text())) warnings.push(m.text());
      });
      await page.addInitScript(() => {
        window.profileLongTasks = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.profileLongTasks.push(e.duration);
        }).observe({ type: "longtask", buffered: true });
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      await page.goto(origin + route);
      await page.locator("h1").first().waitFor();
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      const metrics = await cdp.send("Performance.getMetrics");
      const timing = await page.evaluate(() => ({
        jsBytes: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes("/_next/") && r.name.includes(".js"))
          .reduce((n, r) => n + r.encodedBodySize, 0),
        longTasks: window.profileLongTasks.length,
        longTaskMs: Math.round(window.profileLongTasks.reduce((a, b) => a + b, 0)),
        domReadyMs: Math.round(
          performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd
        ),
      }));
      report.pages.push({
        route,
        run,
        ...timing,
        taskMs: Math.round(metrics.metrics.find((m) => m.name === "TaskDuration").value * 1000),
        apiCalls: calls,
        chartWarnings: warnings.length,
      });
      if (route === "/analytics" && run === 0) {
        for (const days of ["7", "90"]) {
          const before = (await cdp.send("Performance.getMetrics")).metrics.find(
            (m) => m.name === "TaskDuration"
          ).value;
          await page.getByLabel("Date range").selectOption(days);
          await page.waitForLoadState("networkidle");
          await page.locator(".recharts-surface").first().waitFor();
          const after = (await cdp.send("Performance.getMetrics")).metrics.find(
            (m) => m.name === "TaskDuration"
          ).value;
          report.chart.push({
            days,
            taskMs: Math.round((after - before) * 1000),
            svgNodes: await page.locator(".recharts-surface *").count(),
          });
        }
      }
      await context.close();
      console.log(route, run, timing.jsBytes);
    }
  }
  const output = process.env.PROFILE_OUTPUT || "/tmp/vibejournal-profile.json";
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log("Saved " + output);
} finally {
  await browser?.close();
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
  server.kill("SIGTERM");
}
