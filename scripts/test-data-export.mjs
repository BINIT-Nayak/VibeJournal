import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { load } from "./encryption-loader.mjs";
nextEnv.loadEnvConfig(process.cwd());
const { prisma } = load("src/server/db.ts");
const { createEntry } = load("src/server/journal/service.ts");
const { sealValue } = load("src/server/encryption/content.ts");
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const accounts = [];
let stage = "authentication";
async function request(account, path, method = "GET", body) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(account?.cookie ? { Cookie: account.cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (account) {
    const jar = new Map(
      (account.cookie ?? "")
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
  return response;
}
try {
  assert.equal((await request(null, "/api/account/export")).status, 401);
  for (let index = 0; index < 2; index++) {
    const account = { email: "export-" + randomUUID() + "@example.invalid" };
    accounts.push(account);
    const response = await request(account, "/api/auth/signup", "POST", {
      email: account.email,
      password: randomUUID(),
      name: "Export tester",
    });
    assert.equal(response.status, 200);
    account.id = (await response.json()).user.id;
  }
  const [owner, other] = accounts;
  stage = "empty export";
  const empty = await (await request(owner, "/api/account/export")).json();
  assert.equal(empty.schemaVersion, 1);
  assert.deepEqual(empty.journals, []);
  assert.deepEqual(empty.aiAnalyses, []);
  stage = "fixtures";
  const entries = [];
  for (let index = 0; index < 26; index++)
    entries.push(
      await createEntry(
        owner,
        {
          title: "Owner title " + index,
          content: "Owner private writing " + index,
          moodScore: 7,
          energyScore: 6,
          sleepHours: 7.5,
          exercised: false,
          socialScore: 4,
          tags: ["owner-tag"],
        },
        true
      )
    );
  const foreign = await createEntry(
    other,
    { content: "FOREIGN_PRIVATE_SENTINEL", moodScore: 2, tags: ["foreign-tag"] },
    true
  );
  const entry = entries[0];
  const sourceUpdatedAt = new Date(entry.updatedAt);
  await prisma.journalEntry.update({
    where: { id: entry.id },
    data: { archivedAt: new Date(), updatedAt: new Date(+sourceUpdatedAt + 1000) },
  });
  await prisma.userSettings.update({
    where: { userId: owner.id },
    data: {
      favoriteGenres: ["ambient"],
      dislikedGenres: ["metal"],
      preferredLanguages: ["en"],
      allowExplicit: false,
    },
  });
  await prisma.journalAnalysis.create({
    data: {
      userId: owner.id,
      journalEntryId: entry.id,
      sourceUpdatedAt,
      primaryEmotion: "hopeful",
      emotions: ["hopeful"],
      sentimentScore: 0.5,
      estimatedEnergy: 6,
      confidence: 0.8,
      themes: [],
      reflectionPrompt: "",
      privatePayload: await sealValue(
        owner.id,
        "analysis",
        entry.id,
        { themes: ["personal growth"], reflectionPrompt: "What mattered?" },
        sourceUpdatedAt.toISOString()
      ),
    },
  });
  await prisma.playlistRun.create({
    data: {
      userId: owner.id,
      mood: "calm",
      intent: { intent: "focus" },
      provider: "test",
      tracks: [],
    },
  });
  stage = "complete export";
  const response = await request(owner, "/api/account/export");
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-disposition"),
    /^attachment; filename="vibejournal-data-.*\.json"$/
  );
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const text = await response.text();
  const data = JSON.parse(text);
  assert.equal(data.journals.length, 26, "not limited to a UI history page");
  assert.equal(data.account.id, owner.id);
  assert.equal(data.account.email, owner.email);
  const archived = data.journals.find((row) => row.id === entry.id);
  assert.ok(archived.archivedAt);
  assert.equal(archived.content, entry.content);
  assert.equal(archived.tracking.sleepHours, 7.5);
  assert.equal(archived.tracking.exercised, false);
  assert.equal(archived.tags[0].name, "owner-tag");
  assert.equal(data.aiAnalyses[0].stale, true);
  assert.deepEqual(data.aiAnalyses[0].themes, ["personal growth"]);
  assert.equal(data.aiAnalyses[0].reflectionPrompt, "What mattered?");
  assert.deepEqual(data.musicPreferences.favoriteGenres, ["ambient"]);
  assert.equal(data.musicHistory.length, 1);
  assert.equal(data.tags.length, 1);
  assert.ok(
    !text.includes(other.id) &&
      !text.includes(foreign.id) &&
      !text.includes("FOREIGN_PRIVATE_SENTINEL")
  );
  for (const forbidden of [
    "passwordHash",
    "googleSubject",
    "tokenHash",
    "privatePayload",
    "privateLabel",
    "wrappingKeyId",
    "wrapped",
    "contentKeys",
    "sessions",
  ])
    assert.ok(!text.includes('"' + forbidden + '"'), "security internals excluded");
  stage = "cross-account attempts";
  for (const query of ["userId=" + other.id, "id=" + other.id, "email=" + other.email])
    assert.equal((await request(owner, "/api/account/export?" + query)).status, 400);
  const otherData = await (await request(other, "/api/account/export")).json();
  assert.equal(otherData.account.id, other.id);
  assert.equal(otherData.journals.length, 1);
  assert.equal(otherData.journals[0].id, foreign.id);
  assert.deepEqual(otherData.aiAnalyses, []);
  assert.deepEqual(otherData.musicHistory, []);
  stage = "fail closed";
  await prisma.journalEntry.update({
    where: { id: entry.id },
    data: { privatePayload: "e1.invalid" },
  });
  const failed = await request(owner, "/api/account/export");
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).error.code, "EXPORT_UNAVAILABLE");
  assert.equal(failed.headers.get("content-disposition"), null);
  console.log(
    "PASS: authenticated JSON download, empty/full/archived data, tracking, AI metadata, music settings/history, secret exclusion, two-account isolation, forged parameters, corrupt-content failure."
  );
} catch {
  console.error("Data export test failed at", stage, "(private details suppressed).");
  process.exitCode = 1;
} finally {
  await prisma.user.deleteMany({
    where: { email: { in: accounts.map((account) => account.email) } },
  });
  await prisma.$disconnect();
}
