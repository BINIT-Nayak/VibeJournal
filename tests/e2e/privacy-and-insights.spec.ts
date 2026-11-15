import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();
const origin = "http://127.0.0.1:3200";
const headers = { Origin: origin, "Content-Type": "application/json" };
const emails: string[] = [];
test.afterEach(async () => {
  await db.user.deleteMany({ where: { email: { in: emails.splice(0) } } });
});
test.afterAll(async () => {
  await db.$disconnect();
});

async function register(request: APIRequestContext) {
  const email = `insights-${randomUUID()}@example.invalid`;
  emails.push(email);
  const response = await request.post("/api/auth/signup", {
    headers,
    data: { email, password: "InsightsPassword123!", name: "Insights test" },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).user as { id: string };
}

async function writeJournal(page: Page, mood: number, content: string) {
  await page.goto("/journal/new");
  await page.getByLabel("Your reflection", { exact: true }).fill(content);
  await page.getByRole("radio", { name: new RegExp(`^${mood} out of 10`) }).check();
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByText("Synced — saved to your journal.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View saved entry", exact: true }).click();
  await expect(page).toHaveURL(/\/journal\/[^/?]+$/);
  await expect(page.getByText(content, { exact: true })).toBeVisible();
  return new URL(page.url()).pathname;
}

async function createEntry(request: APIRequestContext, content: string, moodScore = 7) {
  const response = await request.post("/api/journal", {
    headers,
    data: { content, moodScore, energyScore: 6, sleepHours: 8, exercised: true, tags: ["walking"] },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).entry as { id: string; updatedAt: string; analysisStatus: string };
}

test("dashboard updates today's check-in and mood after journal creation and editing", async ({
  page,
}) => {
  await register(page.request);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "How are you feeling today?" })).toBeVisible();
  const path = await writeJournal(page, 4, "A difficult morning with room for a better afternoon.");
  await page
    .getByRole("navigation", { name: "Primary navigation", exact: true })
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "You made time for yourself." })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: /^4\/10$/ })).toBeVisible();
  await page.getByRole("link", { name: "View today's entry", exact: true }).click();
  await page.getByRole("link", { name: "Edit entry", exact: true }).click();
  await page.getByRole("radio", { name: /^8 out of 10/ }).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(origin + path);
  await page
    .getByRole("navigation", { name: "Primary navigation", exact: true })
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page.getByRole("definition").filter({ hasText: /^8\/10$/ })).toBeVisible();
  await page.getByText("View mood values as a table", { exact: true }).click();
  await expect(
    page.getByRole("table").getByRole("cell", { name: "8/10", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("table").getByRole("cell", { name: "4/10", exact: true })
  ).toHaveCount(0);
});

test("analytics shows an empty state, populated insights, and accessible 7/30/90-day history", async ({
  page,
}) => {
  await register(page.request);
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Every pattern starts with a reflection" })
  ).toBeVisible();
  // Real encrypted API records; control only dates to create five distinct observation days.
  for (let day = 0; day < 5; day++) {
    const entry = await createEntry(page.request, `Synthetic walking reflection ${day}`);
    await db.journalEntry.update({
      where: { id: entry.id },
      data: { createdAt: new Date(Date.now() - day * 86400000) },
    });
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your patterns over time" })).toBeVisible();
  for (const heading of [
    "Personal insights",
    "Mood trend",
    "Mood and sleep",
    "Mood, energy and exercise",
    "Top tags and mood",
  ]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Every pattern starts with a reflection" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Top tags and mood" }).getByText("walking", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Mood and sleep" })).toContainText(
    "Not enough data to compare yet"
  );
  for (const days of [30, 7, 90]) {
    await page.getByLabel("Date range").selectOption(String(days));
    await expect(
      page.getByRole("group", {
        name: `Daily average mood over the last ${days} days, from 1 to 10`,
        exact: true,
      })
    ).toBeVisible();
    const table = page.getByRole("table", { name: `${days}-day mood history · UTC`, exact: true });
    if (!(await table.isVisible()))
      await page.getByText("View mood values as a table", { exact: true }).click();
    await expect(table.getByRole("row")).toHaveCount(days + 1);
    await expect(table.getByRole("cell", { name: "7/10", exact: true })).toHaveCount(5);
    await expect(table.getByRole("cell", { name: "Not recorded", exact: true })).toHaveCount(
      days - 5
    );
  }
});

test("AI disabled preserves journaling and rejects both automatic and explicitly requested analysis", async ({
  page,
}) => {
  const user = await register(page.request);
  await page.goto("/dashboard#profile");
  const consent = page.getByRole("checkbox", {
    name: "Allow AI analysis of my new journal entries",
    exact: true,
  });
  await expect(consent).not.toBeChecked();
  await expect(page.getByText("AI analysis is off.", { exact: true })).toBeVisible();
  const path = await writeJournal(
    page,
    6,
    "Private synthetic reflection that does not opt into AI."
  );
  await expect(page.getByText(/No AI interpretation is saved for this entry/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Possible emotions" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "A reflection prompt, if useful" })).toHaveCount(
    0
  );
  const entryId = path.split("/").at(-1)!;
  // A forged client flag must not replace the persisted user preference.
  const creation = await page.request.post("/api/journal", {
    headers,
    data: { content: "Second private synthetic reflection", moodScore: 5, aiConsent: true },
  });
  expect(creation.status()).toBe(201);
  expect((await creation.json()).entry.analysisStatus).toBe("skipped");
  const analysis = await page.request.post(`/api/journal/${entryId}/analysis`, {
    headers,
    data: {},
  });
  expect(analysis.status()).toBe(409);
  expect((await analysis.json()).status).toBe("skipped");
  const weekly = await page.request.post("/api/weekly-reflection", { headers, data: {} });
  expect(weekly.status()).toBe(403);
  expect((await weekly.json()).error.code).toBe("CONSENT_REQUIRED");
  expect(await db.journalAnalysis.count({ where: { userId: user.id } })).toBe(0);
  await page.reload();
  await expect(
    page.getByText("Private synthetic reflection that does not opt into AI.", { exact: true })
  ).toBeVisible();
  await page.goto("/dashboard#profile");
  await expect(consent).not.toBeChecked();
});

test("anonymous and other-account visitors cannot read or modify a private journal", async ({
  page,
  request,
  browser,
}) => {
  await register(request);
  const privateContent = `Owner-only synthetic reflection ${randomUUID()}`;
  const entry = await createEntry(request, privateContent);
  const path = `/journal/${entry.id}`;
  const apiPath = `/api/journal/${entry.id}`;
  await register(page.request);
  for (const url of [path, `${path}/edit`]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Entry not found", exact: true })).toBeVisible();
    await expect(page.getByText(privateContent, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  }
  const foreign = await page.request.get(apiPath);
  const missing = await page.request.get(`/api/journal/${randomUUID()}`);
  expect(foreign.status()).toBe(404);
  expect(missing.status()).toBe(404);
  expect(await foreign.json()).toEqual(await missing.json());
  const update = await page.request.patch(apiPath, {
    headers,
    data: { content: "Unauthorized overwrite", expectedUpdatedAt: entry.updatedAt },
  });
  expect(update.status()).toBe(404);
  const deletion = await page.request.delete(apiPath, { headers });
  expect(deletion.status()).toBe(404);
  const ownerRead = await request.get(apiPath);
  expect(ownerRead.status()).toBe(200);
  expect((await ownerRead.json()).entry.content).toBe(privateContent);
  const anonymous = await browser.newContext();
  try {
    const response = await anonymous.request.get(origin + apiPath);
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    const visitor = await anonymous.newPage();
    await visitor.goto(origin + path);
    await expect(visitor).toHaveURL(/\/login/);
    await expect(visitor.getByText(privateContent, { exact: true })).toHaveCount(0);
  } finally {
    await anonymous.close();
  }
});
