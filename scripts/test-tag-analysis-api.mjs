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
    const account = { email: `tag-test-${randomUUID()}@example.invalid`, password: randomUUID() };
    accounts.push(account);
    account.id = (await request(account, "/api/auth/signup", "POST", account)).user.id;
  }
  const [owner, other] = accounts;
  const stats = async (account = owner, days = 30) =>
    (await request(account, `/api/analytics?days=${days}`)).statistics;
  assert.deepEqual((await stats()).tagFrequency, []);
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tags = new Map();
  async function add(age, moodScore, names, extra = {}, account = owner) {
    const entry = await prisma.journalEntry.create({
      data: {
        userId: account.id,
        content: "Private tag fixture",
        moodScore,
        createdAt: new Date(start - age * 86400000),
        ...extra,
      },
    });
    for (const name of names) {
      const key = account.id + name;
      if (!tags.has(key))
        tags.set(key, (await prisma.tag.create({ data: { userId: account.id, name } })).id);
      await prisma.journalTag.create({
        data: { journalEntryId: entry.id, userId: account.id, tagId: tags.get(key) },
      });
    }
  }
  // Four observations do not qualify.
  for (let i = 0; i < 4; i++) await add(i, i + 1, ["work", "shared"]);
  assert.deepEqual((await stats()).tagFrequency, []);
  await add(4, 5, ["work", "shared"]);
  await add(0, 10, ["work"]);
  // Frequent, but only one day: must not qualify.
  for (let i = 0; i < 21; i++) await add(0, 10, ["burst"]);
  // None of these may push a four-day tag over the minimum.
  for (let i = 0; i < 4; i++) await add(i, 1, ["sparse"]);
  await add(4, 10, ["sparse", "work"], { archivedAt: now });
  await add(-1, 10, ["sparse", "work"]);
  await add(30, 10, ["sparse", "work"]);
  for (let i = 0; i < 5; i++) await add(i, 10, ["sparse", "work"], {}, other);
  const result = await stats();
  assert.deepEqual(result.tagCriteria, { minimumObservations: 5, minimumDays: 5, limit: 20 });
  assert.deepEqual(result.tagFrequency, [
    { tag: "work", entryCount: 6, distinctDays: 5, averageMood: 4.17 },
    { tag: "shared", entryCount: 5, distinctDays: 5, averageMood: 3 },
  ]);
  assert.deepEqual((await stats(owner, 4)).tagFrequency, []);
  assert.equal((await stats(other)).tagFrequency.find((t) => t.tag === "work").averageMood, 10);
  // Eligibility must be applied before the top-20 limit; ties sort by name.
  const names = Array.from({ length: 22 }, (_, i) => `tag-${String(i).padStart(2, "0")}`);
  for (let i = 0; i < 5; i++) await add(i, 7, names);
  const top = (await stats()).tagFrequency;
  assert.equal(top.length, 20);
  assert.deepEqual(
    top.map((t) => t.tag),
    ["work", "shared", ...names.slice(0, 18)]
  );
  assert.ok(top.every((t) => t.entryCount >= 5 && t.distinctDays >= 5));
  assert.equal(top[2].averageMood, 7);
  console.log(
    "PASS: tag averages, sample sizes, minimum boundary, repeated-day exclusion, overlapping tags, top-20 ordering, range/archive/future exclusions and ownership."
  );
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
