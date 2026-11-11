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
  const ranges = [7, 30, 90];
  for (const days of ranges) {
    const data = await request(owner, `/api/analytics?days=${days}`);
    const trend = data.statistics.moodTrend;
    assert.equal(trend.length, days);
    assert.equal(data.period.days, days);
    assert.equal(data.period.timeZone, "UTC");
    assert.equal(trend[0].date, data.period.startDate);
    assert.equal(trend.at(-1).date, data.period.endDate);
    assert.equal(data.statistics.mood.average, null);
    for (const point of trend)
      assert.deepEqual(point, {
        date: point.date,
        averageMood: null,
        averageEnergy: null,
        journalCount: 0,
      });
    assert.equal(new Set(trend.map((point) => point.date)).size, days);
    for (let i = 1; i < trend.length; i++)
      assert.equal(Date.parse(trend[i].date) - Date.parse(trend[i - 1].date), 86400000);
  }
  // Use the API's UTC date, avoiding the host machine's time zone.
  const base = await request(owner, "/api/analytics?days=90");
  const today = Date.parse(base.period.endDate + "T00:00:00.000Z");
  const fixtures = [
    { age: 0, score: 2, energy: null },
    { age: 0, score: 8, energy: 4 },
    { age: 6, score: 4, energy: null },
    { age: 7, score: 6, energy: 8 },
    { age: 29, score: 9, energy: 2 },
    { age: 30, score: 3, energy: null },
    { age: 89, score: 7, energy: 5 },
    { age: 90, score: 1, energy: 1 },
  ];
  await prisma.journalEntry.createMany({
    data: fixtures.map((row) => ({
      userId: owner.id,
      content: "Sparse mood test",
      moodScore: row.score,
      energyScore: row.energy,
      createdAt: new Date(today - row.age * 86400000),
    })),
  });
  await prisma.journalEntry.createMany({
    data: [
      {
        userId: owner.id,
        content: "Archived",
        moodScore: 10,
        createdAt: new Date(today - 2 * 86400000),
        archivedAt: new Date(),
      },
      { userId: owner.id, content: "Future", moodScore: 10, createdAt: new Date(today + 86400000) },
      {
        userId: other.id,
        content: "Other user",
        moodScore: 10,
        createdAt: new Date(today - 3 * 86400000),
      },
    ],
  });
  for (const days of ranges) {
    const data = await request(owner, `/api/analytics?days=${days}`);
    // A run crossing UTC midnight should fail clearly, not give misleading assertions.
    assert.equal(data.period.endDate, base.period.endDate, "UTC date changed during test; rerun");
    const included = fixtures.filter((row) => row.age < days);
    const trend = data.statistics.moodTrend;
    assert.equal(trend.length, days);
    assert.equal(data.statistics.journalCount, included.length);
    assert.equal(
      data.statistics.mood.average,
      Math.round((included.reduce((sum, row) => sum + row.score, 0) / included.length) * 100) / 100
    );
    for (const point of trend) {
      const records = included.filter(
        (row) => new Date(today - row.age * 86400000).toISOString().slice(0, 10) === point.date
      );
      const energies = records.filter((row) => row.energy !== null);
      assert.equal(point.journalCount, records.length);
      assert.equal(
        point.averageMood,
        records.length ? records.reduce((sum, row) => sum + row.score, 0) / records.length : null
      );
      assert.equal(
        point.averageEnergy,
        energies.length
          ? energies.reduce((sum, row) => sum + row.energy, 0) / energies.length
          : null
      );
    }
    assert.equal(trend.at(-1).averageMood, 5); // Two entries today are averaged, not overwritten.
    assert.equal(trend.at(-1).averageEnergy, 4); // Unknown energy is not counted as zero.
    assert.equal(trend.at(-2).averageMood, null); // No forward-fill or interpolation.
    assert.equal(trend.at(-3).averageMood, null); // Archived-only day is a gap.
    assert.equal(trend.at(-4).averageMood, null); // Another user's entry is not a data point.
    assert.ok(trend[0].averageMood !== null); // Exact start boundary is included.
  }
  console.log(
    "PASS: empty and sparse 7/30/90-day series, exact lengths, ordered UTC dates, null gaps, daily averages, weighted period averages, range boundaries and isolation."
  );
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
