import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const accounts = [];

async function request(account, path, method = "GET", body, expected = 200) {
  if (method === "PATCH" && account?.cookie && body && !("expectedUpdatedAt" in body)) {
    const current = await fetch(`${origin}${path}`, { headers: { Cookie: account.cookie } });
    if (current.ok) body = { ...body, expectedUpdatedAt: (await current.json()).entry.updatedAt };
  }
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(origin).origin,
      ...(account?.cookie ? { Cookie: account.cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, expected, `${method} ${path}`);
  if (account) {
    const jar = new Map(
      (account.cookie || "")
        .split("; ")
        .filter(Boolean)
        .map((pair) => [pair.split("=")[0], pair])
    );
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      jar.set(pair.split("=")[0], pair);
    }
    account.cookie = [...jar.values()].join("; ");
  }
  return response.status === 204 ? null : response.json();
}

try {
  await request(null, "/api/entries", "GET", undefined, 401);
  for (let index = 0; index < 2; index++) {
    const account = {
      email: `journal-test-${randomUUID()}@example.invalid`,
      password: randomUUID(),
    };
    accounts.push(account);
    const result = await request(account, "/api/auth/signup", "POST", account);
    account.id = result.user.id;
  }
  const [owner, other] = accounts;
  const empty = await request(owner, "/api/dashboard?timeZone=UTC");
  assert.equal(empty.journalCount, 0);
  assert.equal(empty.weeklyAverageMood, null);
  assert.equal(empty.averageEnergy, null);
  assert.equal(empty.moodTrend.length, 7);
  assert.equal(empty.today.hasJournaled, false);
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = 86400000;
  const rows = [
    { createdAt: new Date(+start + 1), moodScore: 2, energyScore: null },
    { createdAt: new Date(+start + 2), moodScore: 8, energyScore: 6 },
    { createdAt: new Date(+start - day + 1), moodScore: 6, energyScore: 4 },
    { createdAt: new Date(+start - 6 * day + 1), moodScore: 4, energyScore: null },
    ...Array.from({ length: 7 }, (_, i) => ({
      createdAt: new Date(+start - (7 + i) * day),
      moodScore: 10,
      energyScore: 10,
    })),
  ];
  await prisma.journalEntry.createMany({
    data: rows.map((row) => ({ ...row, userId: owner.id, content: "Aggregation fixture" })),
  });
  await prisma.journalEntry.create({
    data: {
      userId: owner.id,
      content: "Archived fixture",
      moodScore: 10,
      energyScore: 10,
      createdAt: new Date(+start + 3),
      archivedAt: now,
    },
  });
  await prisma.journalEntry.create({
    data: {
      userId: owner.id,
      content: "Future fixture",
      moodScore: 10,
      createdAt: new Date(+now + day),
    },
  });
  await prisma.journalEntry.create({
    data: { userId: other.id, content: "Other user fixture", moodScore: 10, createdAt: now },
  });
  const data = await request(owner, "/api/dashboard?timeZone=UTC");
  assert.equal(data.journalCount, 11);
  assert.equal(data.weeklyJournalCount, 4);
  assert.equal(data.weeklyAverageMood, 5);
  assert.equal(data.averageEnergy, 5);
  assert.equal(data.today.journalCount, 2);
  assert.equal(data.today.hasJournaled, true);
  assert.equal(data.recentEntries.length, 5);
  assert.equal(data.moodTrend[6].averageMood, 5);
  assert.equal(data.moodTrend[6].journalCount, 2);
  assert.equal(data.moodTrend[1].averageMood, null);
  assert.equal(data.moodTrend[1].journalCount, 0);
  assert.equal(data.personalInsights.status, "coming_soon");
  assert.equal(data.musicRecommendations.status, "coming_soon");
  for (const zone of ["Asia/Kolkata", "America/New_York", "Pacific/Kiritimati"]) {
    const local = await request(owner, `/api/dashboard?timeZone=${encodeURIComponent(zone)}`);
    const format = (date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    assert.equal(local.today.date, format(new Date(local.asOf)));
    for (const bucket of local.moodTrend) {
      const expected = rows.filter((row) => format(row.createdAt) === bucket.date);
      assert.equal(bucket.journalCount, expected.length);
    }
  }
  await request(null, "/api/dashboard", "GET", undefined, 401);
  await request(owner, "/api/dashboard?timeZone=Invalid/Zone", "GET", undefined, 400);
  const isolated = await request(other, "/api/dashboard?timeZone=UTC");
  assert.equal(isolated.journalCount, 1);
  assert.equal(isolated.weeklyAverageMood, 10);
  console.log(
    "PASS: empty dashboard, aggregate averages/nulls, daily bins/time zones, archived/future exclusions, bounded recents, placeholders, authentication and isolation."
  );
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
