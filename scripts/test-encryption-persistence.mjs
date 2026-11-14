import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { load } from "./encryption-loader.mjs";
nextEnv.loadEnvConfig(process.cwd());
const { prisma } = load("src/server/db.ts");
const service = load("src/server/journal/service.ts");
const { replayMutation } = load("src/server/journal-sync/service.ts");
const { clearKeyCache } = load("src/server/encryption/keys.ts");
const { EncryptionError } = load("src/server/encryption/envelope.ts");
const { getDashboard } = load("src/server/dashboard/service.ts");
const { getAnalytics } = load("src/server/analytics/service.ts");
let user;
let stage = "setup";
try {
  user = await prisma.user.create({
    data: { email: "encryption-" + randomUUID() + "@example.invalid", settings: { create: {} } },
  });
  const values = {
    title: "Private title",
    content: "Private journal content",
    moodScore: 7,
    energyScore: 6,
    tags: ["private tag"],
    sleepHours: 8,
    exercised: true,
  };
  stage = "create";
  const entry = await service.createEntry(user, values, true);
  stage = "create-result";
  assert.equal(entry.content, values.content);
  assert.deepEqual(entry.tags, values.tags);
  const row = await prisma.journalEntry.findUniqueOrThrow({ where: { id: entry.id } });
  assert.equal(row.content, "");
  assert.equal(row.title, null);
  assert.ok(row.privatePayload.startsWith("e1."));
  const tag = await prisma.tag.findFirstOrThrow({ where: { userId: user.id } });
  assert.ok(tag.name.startsWith("h1:"));
  assert.ok(tag.privateLabel.startsWith("e1."));
  stage = "read";
  assert.equal((await service.getEntry(user, entry.id, true)).content, values.content);
  assert.equal(
    (await service.listEntryPage(user, { limit: "10" })).entries[0].content,
    values.content
  );
  stage = "dashboard";
  assert.ok(JSON.stringify(await getDashboard(user, {})).includes(values.content));
  stage = "analytics";
  await getAnalytics(user, { days: "7" });
  await assert.rejects(
    service.getEntry({ id: "another-user" }, entry.id, true),
    service.JournalNotFoundError
  );
  stage = "update";
  const updated = await service.updateEntry(
    user,
    entry.id,
    { content: "Edited private content", expectedUpdatedAt: entry.updatedAt },
    true
  );
  assert.equal(updated.title, values.title);
  assert.equal(updated.content, "Edited private content");
  assert.deepEqual(updated.tags, values.tags);
  await assert.rejects(
    service.updateEntry(
      user,
      entry.id,
      { content: "stale", expectedUpdatedAt: entry.updatedAt },
      true
    ),
    service.JournalConflictError
  );
  stage = "sync";
  const mutation = { kind: "create", key: randomUUID(), entryId: randomUUID(), values };
  const result = await replayMutation(user.id, mutation);
  assert.deepEqual(await replayMutation(user.id, mutation), result);
  const receipt = await prisma.journalMutationReceipt.findUniqueOrThrow({
    where: { userId_key: { userId: user.id, key: mutation.key } },
  });
  assert.ok(receipt.payloadHash.startsWith("e1."));
  await assert.rejects(
    replayMutation(user.id, { ...mutation, values: { ...values, content: "different" } }),
    service.JournalConflictError
  );
  stage = "ai-storage";
  await prisma.userSettings.update({ where: { userId: user.id }, data: { aiConsent: true } });
  const { analyzeAndStoreEntry } = load("src/server/journal-analysis/after-create.ts");
  const { getJournalAnalysis } = load("src/server/journal-analysis/read.ts");
  const ai = {
    primaryEmotion: "hopeful",
    emotions: ["hopeful"],
    sentimentScore: 0.4,
    themes: ["private theme"],
    estimatedEnergy: 6,
    reflectionPrompt: "Private reflection?",
    confidence: 0.7,
  };
  assert.equal(await analyzeAndStoreEntry(user.id, entry.id, { analyze: async () => ai }), "saved");
  const storedAnalysis = await prisma.journalAnalysis.findUniqueOrThrow({
    where: { journalEntryId: entry.id },
  });
  assert.deepEqual(storedAnalysis.themes, []);
  assert.equal(storedAnalysis.reflectionPrompt, "");
  assert.ok(storedAnalysis.privatePayload.startsWith("e1."));
  const view = await getJournalAnalysis(user.id, entry.id, updated.updatedAt);
  assert.equal(view.status, "available");
  assert.equal(view.analysis.reflectionPrompt, ai.reflectionPrompt);
  assert.deepEqual(view.analysis.themes, ai.themes);
  stage = "key-failure";
  const originalKey = process.env.JOURNAL_DEVELOPMENT_WRAPPING_KEY;
  clearKeyCache();
  process.env.JOURNAL_DEVELOPMENT_WRAPPING_KEY = randomBytes(32).toString("base64");
  await assert.rejects(service.getEntry(user, entry.id, true), EncryptionError);
  const before = await prisma.journalEntry.count({ where: { userId: user.id } });
  await assert.rejects(service.createEntry(user, values, true), EncryptionError);
  assert.equal(await prisma.journalEntry.count({ where: { userId: user.id } }), before);
  process.env.JOURNAL_DEVELOPMENT_WRAPPING_KEY = originalKey;
  clearKeyCache();
  stage = "tamper";
  const stored = await prisma.journalEntry.findUniqueOrThrow({ where: { id: entry.id } });
  const envelope = JSON.parse(Buffer.from(stored.privatePayload.slice(3), "base64").toString());
  const tagBytes = Buffer.from(envelope.tag, "base64");
  tagBytes[0] ^= 1;
  envelope.tag = tagBytes.toString("base64");
  await prisma.journalEntry.update({
    where: { id: entry.id },
    data: { privatePayload: "e1." + Buffer.from(JSON.stringify(envelope)).toString("base64") },
  });
  await assert.rejects(service.getEntry(user, entry.id, true), EncryptionError);
  await assert.rejects(
    prisma.journalEntry.update({ where: { id: entry.id }, data: { content: "plaintext rejected" } })
  );
  console.log(
    "Persistence tests passed: encrypted storage, tags, reads, dashboard, analytics, updates, ownership, stale versions, sync replay, unavailable keys, tampering, plaintext-write rejection."
  );
} catch {
  console.error("Encryption persistence test failed at", stage, "; sensitive details suppressed.");
  process.exitCode = 1;
} finally {
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
