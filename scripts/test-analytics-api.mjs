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
  await request(null, "/api/analytics", "GET", undefined, 401);
  const empty = await request(owner, "/api/analytics");
  assert.equal(empty.statistics.journalCount, 0);
  assert.equal(empty.statistics.mood.average, null);
  assert.equal(empty.statistics.moodTrend.length, 30);
  assert.equal(empty.insights[0].kind, "empty");
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ids = [];
  for (let i = 1; i <= 10; i++) {
    const { entry } = await request(
      owner,
      "/api/journal",
      "POST",
      {
        content: "Private analytics fixture",
        moodScore: i,
        energyScore: i,
        sleepHours: 11 - i,
        exercised: i >= 6,
        tags: [i <= 6 ? "work" : "rest"],
      },
      201
    );
    ids.push(entry.id);
    await prisma.journalEntry.update({
      where: { id: entry.id },
      data: { createdAt: new Date(+start - (10 - i) * 86400000 + 1) },
    });
  }
  await prisma.journalEntry.create({
    data: {
      userId: owner.id,
      content: "Private missing fixture",
      moodScore: 5,
      createdAt: new Date(+start + 2),
    },
  });
  await prisma.journalEntry.create({
    data: { userId: owner.id, content: "Archived", moodScore: 10, archivedAt: now },
  });
  await prisma.journalEntry.create({
    data: {
      userId: owner.id,
      content: "Future",
      moodScore: 10,
      createdAt: new Date(+now + 86400000),
    },
  });
  const data = await request(owner, "/api/analytics?days=30");
  assert.equal(data.statistics.journalCount, 11);
  assert.equal(data.statistics.mood.average, 5.45);
  assert.equal(data.statistics.energy.average, 5.5);
  assert.equal(data.statistics.energy.missingCount, 1);
  assert.equal(data.statistics.sleep.average, 5.5);
  assert.equal(data.statistics.sleep.minHours, 1);
  assert.equal(data.statistics.sleep.maxHours, 10);
  assert.equal(data.statistics.exercise.yesCount, 5);
  assert.equal(data.statistics.exercise.noCount, 5);
  assert.equal(data.statistics.exercise.missingCount, 1);
  assert.equal(data.statistics.exercise.averageMoodWhenExercised, 8);
  assert.equal(data.statistics.exercise.averageMoodWhenNotExercised, 3);
  assert.equal(data.correlations.find((c) => c.metric === "energy").coefficient, 1);
  assert.equal(data.correlations.find((c) => c.metric === "sleep").coefficient, -1);
  assert.equal(data.correlations.find((c) => c.metric === "exercise").coefficient, 0.87);
  assert.deepEqual(data.statistics.tagFrequency, [
    { tag: "work", entryCount: 6, distinctDays: 6, averageMood: 3.5 },
  ]);
  assert.equal(data.statistics.moodTrend[0].averageMood, null);
  assert.equal(data.statistics.moodTrend[29].averageMood, 7.5);
  assert.equal(data.statistics.moodTrend[29].journalCount, 2);
  assert.equal(JSON.stringify(data).includes("Private"), false);
  assert.ok(
    data.insights.some(
      (i) => i.kind === "association" && i.text.includes("not evidence of cause and effect")
    )
  );
  const week = await request(owner, "/api/analytics?days=7");
  assert.equal(week.statistics.journalCount, 8);
  assert.ok(week.correlations.every((c) => c.status === "insufficient_data"));
  await prisma.journalEntry.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({
      userId: other.id,
      content: "Constant mood",
      moodScore: 5,
      energyScore: i + 1,
      sleepHours: 0,
      exercised: false,
      createdAt: new Date(+start - i * 86400000 + 1),
    })),
  });
  const constant = await request(other, "/api/analytics");
  assert.equal(constant.statistics.journalCount, 10);
  assert.ok(
    constant.correlations.every((c) => c.status === "no_variation" && c.coefficient === null)
  );
  assert.equal(constant.statistics.sleep.average, 0);
  assert.equal(constant.statistics.exercise.noCount, 10);
  assert.equal(constant.statistics.tagFrequency.length, 0);
  for (const days of ["0", "91", "-1", "2.5", "oops"])
    await request(owner, `/api/analytics?days=${days}`, "GET", undefined, 400);
  console.log(
    "PASS: analytics averages/counts/nulls, daily trend, sleep/exercise, tags, positive/negative/binary correlations, insufficient/constant data, private text omission, exclusions and ownership."
  );
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
