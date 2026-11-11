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
  await request(null, "/api/analytics", "GET", undefined, 401);
  for (let index = 0; index < 2; index++) {
    const account = { email: `sleep-test-${randomUUID()}@example.invalid`, password: randomUUID() };
    accounts.push(account);
    account.id = (await request(account, "/api/auth/signup", "POST", account)).user.id;
  }
  const [owner, other] = accounts;
  const comparison = async (account = owner, days = 30) =>
    (await request(account, `/api/analytics?days=${days}`)).sleepComparison;
  const empty = await comparison();
  assert.equal(empty.status, "insufficient_data");
  assert.deepEqual(empty.atLeast7Hours, { sampleSize: 0, averageMood: null });
  assert.deepEqual(empty.lessThan7Hours, { sampleSize: 0, averageMood: null });
  assert.equal(empty.moodDifference, null);
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const add = (age, moodScore, sleepHours, extra = {}) =>
    prisma.journalEntry.create({
      data: {
        userId: owner.id,
        content: "Sleep analysis fixture",
        moodScore,
        sleepHours,
        createdAt: new Date(start - age * 86400000),
        ...extra,
      },
    });
  // A repeated day contributes one daily mood mean (5) and mean sleep (7).
  await add(0, 2, 6);
  await add(0, 8, 8);
  await add(5, 4, 6.999);
  await add(10, 10, null);
  const sparse = await comparison();
  assert.deepEqual(sparse.atLeast7Hours, { sampleSize: 1, averageMood: 5 });
  assert.deepEqual(sparse.lessThan7Hours, { sampleSize: 1, averageMood: 4 });
  assert.equal(sparse.excludedDaysWithoutSleep, 1);
  assert.equal(sparse.status, "insufficient_data");
  assert.equal(sparse.moodDifference, null);
  assert.match(sparse.summary, /No conclusion/);
  for (let i = 1; i <= 4; i++) await add(i, 8, 7);
  for (const [age, hours] of [
    [6, 0],
    [7, 6],
    [8, 5],
    [9, 6.5],
  ])
    await add(age, 4, hours);
  await add(9, 4, 6.5);
  await add(11, 10, null);
  await add(12, 10, 9, { archivedAt: now });
  await add(-1, 10, 9);
  for (let i = 0; i < 5; i++) await add(i, 1, 9, { userId: other.id });
  const full = await comparison();
  assert.deepEqual(full.atLeast7Hours, { sampleSize: 5, averageMood: 7.4 });
  assert.deepEqual(full.lessThan7Hours, { sampleSize: 5, averageMood: 4 });
  assert.equal(full.status, "available");
  assert.equal(full.sampleUnit, "day");
  assert.equal(full.thresholdHours, 7);
  assert.equal(full.minimumDaysPerGroup, 5);
  assert.equal(full.moodDifference, 3.4);
  assert.equal(full.excludedDaysWithoutSleep, 2);
  assert.match(full.summary, /not evidence/);
  const week = await comparison(owner, 7);
  assert.equal(week.atLeast7Hours.sampleSize, 5);
  assert.equal(week.lessThan7Hours.sampleSize, 2);
  assert.equal(week.status, "insufficient_data");
  assert.equal(week.moodDifference, null);
  const oneGroup = await comparison(other);
  assert.deepEqual(oneGroup.atLeast7Hours, { sampleSize: 5, averageMood: 1 });
  assert.deepEqual(oneGroup.lessThan7Hours, { sampleSize: 0, averageMood: null });
  assert.equal(oneGroup.status, "insufficient_data");
  console.log(
    "PASS: sleep comparison empty/sparse/one-group data, threshold boundaries, zero/missing sleep, daily weighting, sample minimum, ranges and ownership/exclusions."
  );
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
