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
  for (let i = 0; i < 2; i++) {
    const account = {
      email: `exercise-test-${randomUUID()}@example.invalid`,
      password: randomUUID(),
    };
    accounts.push(account);
    account.id = (await request(account, "/api/auth/signup", "POST", account)).user.id;
  }
  const [owner, other] = accounts;
  const comparison = async (account = owner, days = 30) =>
    (await request(account, `/api/analytics?days=${days}`)).exerciseComparison;
  const empty = await comparison();
  for (const metric of ["mood", "energy"]) {
    assert.equal(empty[metric].status, "insufficient_data");
    assert.deepEqual(empty[metric].exercise, { sampleSize: 0, average: null });
    assert.deepEqual(empty[metric].nonExercise, { sampleSize: 0, average: null });
    assert.equal(empty[metric].difference, null);
  }
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const add = (age, exercised, moodScore, energyScore, extra = {}) =>
    prisma.journalEntry.create({
      data: {
        userId: owner.id,
        content: "Exercise fixture",
        exercised,
        moodScore,
        energyScore,
        createdAt: new Date(start - age * 86400000),
        ...extra,
      },
    });
  await add(0, true, 2, 2);
  await add(0, true, 8, 8);
  await add(5, false, 4, 3);
  const sparse = await comparison();
  assert.deepEqual(sparse.mood.exercise, { sampleSize: 1, average: 5 });
  assert.deepEqual(sparse.energy.exercise, { sampleSize: 1, average: 5 });
  assert.equal(sparse.mood.difference, null);
  assert.match(sparse.mood.summary, /No conclusion/);
  for (let i = 1; i <= 4; i++) await add(i, true, 8, i === 4 ? null : 9);
  for (let i = 6; i <= 9; i++) await add(i, false, 4, 3);
  await add(9, false, 4, null);
  await add(10, null, 10, 10);
  await add(11, true, 10, 10);
  await add(11, false, 1, 1);
  await add(12, true, 10, 10, { archivedAt: now });
  await add(-1, false, 10, 10);
  await add(40, true, 1, 1);
  for (let i = 0; i < 5; i++) await add(i, false, 1, 1, { userId: other.id });
  const full = await comparison();
  assert.equal(full.sampleUnit, "day");
  assert.equal(full.minimumDaysPerGroup, 5);
  assert.equal(full.excludedDaysWithoutExercise, 1);
  assert.equal(full.excludedDaysWithConflictingExercise, 1);
  assert.deepEqual(full.mood.exercise, { sampleSize: 5, average: 7.4 });
  assert.deepEqual(full.mood.nonExercise, { sampleSize: 5, average: 4 });
  assert.equal(full.mood.status, "available");
  assert.equal(full.mood.difference, 3.4);
  assert.match(full.mood.summary, /not evidence/);
  assert.deepEqual(full.energy.exercise, { sampleSize: 4, average: 8 });
  assert.deepEqual(full.energy.nonExercise, { sampleSize: 5, average: 3 });
  assert.equal(full.energy.status, "insufficient_data");
  assert.equal(full.energy.difference, null);
  // Unknown status does not override the day's explicit status; only recorded energy counts.
  await add(4, null, 8, 9);
  const enough = await comparison();
  assert.deepEqual(enough.energy.exercise, { sampleSize: 5, average: 8.2 });
  assert.equal(enough.energy.status, "available");
  assert.equal(enough.energy.difference, 5.2);
  assert.match(enough.energy.summary, /not evidence/);
  const week = await comparison(owner, 7);
  assert.equal(week.mood.exercise.sampleSize, 5);
  assert.equal(week.mood.nonExercise.sampleSize, 2);
  assert.equal(week.mood.status, "insufficient_data");
  const isolated = await comparison(other);
  assert.deepEqual(isolated.mood.nonExercise, { sampleSize: 5, average: 1 });
  assert.equal(isolated.mood.exercise.sampleSize, 0);
  assert.equal(isolated.mood.status, "insufficient_data");
  console.log(
    "PASS: exercise comparison empty/sparse/one-group data, daily means, missing energy, conflicting/unknown exercise, per-metric minimums, ownership and date exclusions."
  );
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
