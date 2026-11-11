import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const accounts = [];

async function request(account, path, method = "GET", body, expected = 200) {
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
  return response.json();
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
  const input = {
    mood: "hopeful",
    energy: 7,
    stress: 3,
    valence: 8,
    note: "Temporary cutover API test",
    tags: ["work", "rest", "work"],
    sleepHours: 7.5,
    exerciseMinutes: 20,
    socialLevel: 6,
    voiceNote: "Temporary transcript",
    photoNames: ["test.png"],
  };
  const { entry } = await request(owner, "/api/entries", "POST", input, 201);
  assert.deepEqual(entry.tags, ["work", "rest"]);
  assert.equal(entry.voiceNote, input.voiceNote);
  assert.deepEqual(entry.photoNames, input.photoNames);
  const path = `/api/entries/${entry.id}`;
  const persisted = await prisma.journalEntry.findUniqueOrThrow({ where: { id: entry.id } });
  assert.equal(persisted.moodScore, 8);
  assert.equal(persisted.exercised, true);
  assert.equal(await prisma.moodEntry.count({ where: { userId: owner.id } }), 0);
  for (const method of ["GET", "PATCH", "DELETE"]) {
    await request(other, path, method, method === "PATCH" ? { note: "Forbidden" } : undefined, 404);
  }
  const changed = await request(owner, path, "PATCH", {
    tags: ["rest", "new-tag"],
    archived: true,
    note: "Updated temporary test",
  });
  assert.deepEqual(changed.entry.tags, ["rest", "new-tag"]);
  assert.ok(changed.entry.archivedAt);
  assert.equal(changed.entry.energy, 7);
  assert.equal(changed.entry.voiceNote, input.voiceNote);
  const unarchived = await request(owner, path, "PATCH", { archived: false });
  assert.equal(unarchived.entry.archivedAt, undefined);
  await request(owner, path, "PATCH", { energy: 2.5, tags: ["must-rollback"] }, 400);
  const afterFailure = await request(owner, path);
  assert.deepEqual(afterFailure.entry.tags, ["rest", "new-tag"]);
  assert.equal(afterFailure.entry.energy, 7);
  // Canonical creation and partial editing share the client validation rules.
  const canonical = {
    title: "  A quiet day  ",
    content: "  A reflection  ",
    moodScore: 10,
    energyScore: 1,
    sleepHours: 24,
    exercised: false,
    socialScore: 10,
    tags: [" Rest ", "rest"],
  };
  const created = await request(
    owner,
    "/api/entries",
    "POST",
    { ...canonical, userId: other.id },
    201
  );
  const canonicalPath = `/api/entries/${created.entry.id}`;
  assert.equal(created.entry.title, "A quiet day");
  assert.deepEqual(created.entry.tags, ["rest"]);
  const row = await prisma.journalEntry.findUniqueOrThrow({ where: { id: created.entry.id } });
  assert.equal(row.userId, owner.id);
  assert.equal(row.exercised, false);
  for (const invalid of [
    { content: " " },
    { title: "x".repeat(201) },
    { moodScore: 0 },
    { moodScore: 11 },
    { energyScore: 1.5 },
    { sleepHours: 25 },
    { sleepHours: -1 },
    { exercised: "false" },
    { socialScore: 0 },
    { tags: [" "] },
    { tags: ["x".repeat(41)] },
    { tags: Array(21).fill("rest") },
    { moodScore: "5" },
  ]) {
    const failed = await request(owner, canonicalPath, "PATCH", invalid, 400);
    assert.ok(failed.issues.length);
    await request(owner, "/api/entries", "POST", { ...canonical, ...invalid }, 400);
  }
  await request(owner, canonicalPath, "PATCH", {}, 400);
  await request(owner, canonicalPath, "PATCH", {
    title: null,
    energyScore: null,
    sleepHours: null,
    exercised: null,
    socialScore: null,
    tags: [],
  });
  const cleared = await prisma.journalEntry.findUniqueOrThrow({ where: { id: created.entry.id } });
  assert.equal(cleared.content, "A reflection");
  assert.equal(cleared.moodScore, 10);
  for (const field of ["title", "energyScore", "sleepHours", "exercised", "socialScore"])
    assert.equal(cleared[field], null);
  await request(owner, canonicalPath, "DELETE");
  await request(owner, "/api/auth/logout", "POST");
  const login = await request(owner, "/api/auth/login", "POST", {
    email: owner.email,
    password: owner.password,
  });
  assert.equal(login.entries[0].id, entry.id);
  const session = await request(owner, "/api/auth/me");
  assert.deepEqual(session.entries[0].tags, ["rest", "new-tag"]);
  await request(owner, path, "DELETE");
  assert.equal(await prisma.journalTag.count({ where: { journalEntryId: entry.id } }), 0);
  const optionalEntry = await prisma.journalEntry.create({
    data: { userId: owner.id, content: "Optional fields remain unknown", moodScore: 5 },
  });
  await request(owner, `/api/entries/${optionalEntry.id}`, "PATCH", { archived: true });
  const optionalAfterEdit = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: optionalEntry.id },
  });
  assert.equal(optionalAfterEdit.energyScore, null);
  assert.equal(optionalAfterEdit.stress, null);
  assert.equal(optionalAfterEdit.exercised, null);
  await request(owner, "/api/entries", "POST", input, 201);
  await request(owner, "/api/entries", "DELETE");
  assert.equal((await request(owner, "/api/entries")).entries.length, 0);
  console.log("PASS: auth, CRUD, tag replacement, archive, rollback, isolation, and bulk deletion");
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
