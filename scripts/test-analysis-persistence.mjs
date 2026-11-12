import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import ts from "typescript";

// Compile the actual modules in memory using the installed TypeScript compiler.
// No provider, database, network, or generated source files are needed.
const cache = new Map();
function loadTypeScript(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const require = createRequire(filename);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  new Function("require", "exports", compiled.outputText)(
    (specifier) =>
      specifier.startsWith("@/")
        ? loadTypeScript(resolve("src", specifier.slice(2) + ".ts"))
        : specifier.startsWith(".")
          ? loadTypeScript(resolve(dirname(filename), specifier + ".ts"))
          : require(specifier),
    exports
  );
  return exports;
}
const valid = {
  primaryEmotion: "hopeful",
  emotions: ["hopeful", "anxious"],
  sentimentScore: 0.3,
  themes: ["Work", "Change"],
  estimatedEnergy: 6,
  reflectionPrompt: "What felt within your control today?",
  confidence: 0.7,
};

const { default: nextEnv } = await import("@next/env");
nextEnv.loadEnvConfig(process.cwd());
const { randomUUID } = await import("node:crypto");
const { prisma } = loadTypeScript(resolve("src/server/db.ts"));
const { analyzeCreatedEntry } = loadTypeScript(
  resolve("src/server/journal-analysis/after-create.ts")
);
const { createEntry } = loadTypeScript(resolve("src/server/journal/service.ts"));
const { getJournalAnalysis } = loadTypeScript(resolve("src/server/journal-analysis/read.ts"));
const repository = loadTypeScript(resolve("src/server/journal-analysis/repository.ts"));
const users = [];
const originalProvider = process.env.AI_JOURNAL_PROVIDER;
try {
  // Ensure this test never contacts a real provider, even with configured credentials.
  process.env.AI_JOURNAL_PROVIDER = "disabled-for-test";
  for (const consent of [true, false])
    users.push(
      await prisma.user.create({
        data: {
          email: `analysis-test-${randomUUID()}@example.invalid`,
          settings: { create: { aiConsent: consent } },
        },
      })
    );
  const [owner, other] = users;
  // Actual creation remains successful when configured analysis fails.
  const entry = await createEntry(owner, { content: "Private reflection", moodScore: 6 }, true);
  assert.ok(await prisma.journalEntry.findUnique({ where: { id: entry.id } }));
  assert.equal(await prisma.journalAnalysis.count({ where: { journalEntryId: entry.id } }), 0);
  let calls = 0;
  const provider = {
    analyze: async (input) => {
      calls++;
      assert.deepEqual(input, { title: null, content: "Private reflection" });
      return valid;
    },
  };
  assert.equal(await analyzeCreatedEntry(other.id, entry.id, provider), "skipped");
  const noConsent = await createEntry(other, { content: "Private reflection", moodScore: 5 }, true);
  assert.equal(await analyzeCreatedEntry(other.id, noConsent.id, provider), "skipped");
  assert.equal(calls, 0);
  assert.equal(await analyzeCreatedEntry(owner.id, entry.id, provider), "saved");
  const row = await prisma.journalAnalysis.findUnique({ where: { journalEntryId: entry.id } });
  for (const key of Object.keys(valid)) assert.deepEqual(row[key], valid[key]);
  assert.equal(row.userId, owner.id);
  assert.equal(row.sourceUpdatedAt.toISOString(), entry.updatedAt);
  const display = await getJournalAnalysis(owner.id, entry.id, entry.updatedAt);
  assert.equal(display.status, "available");
  assert.deepEqual(display.analysis, {
    primaryEmotion: valid.primaryEmotion,
    emotions: valid.emotions,
    themes: valid.themes,
    reflectionPrompt: valid.reflectionPrompt,
  });
  assert.equal((await getJournalAnalysis(other.id, entry.id, entry.updatedAt)).status, "missing");
  assert.equal(
    (await getJournalAnalysis(owner.id, entry.id, new Date(0).toISOString())).status,
    "stale"
  );
  await prisma.journalAnalysis.update({
    where: { journalEntryId: entry.id },
    data: { confidence: 99 },
  });
  assert.equal(
    (await getJournalAnalysis(owner.id, entry.id, entry.updatedAt)).status,
    "unavailable"
  );
  await prisma.journalAnalysis.update({
    where: { journalEntryId: entry.id },
    data: { confidence: valid.confidence },
  });
  const read = repository.findStoredAnalysis;
  repository.findStoredAnalysis = async () => {
    throw new Error("private database error");
  };
  try {
    assert.deepEqual(await getJournalAnalysis(owner.id, entry.id, entry.updatedAt), {
      status: "unavailable",
    });
  } finally {
    repository.findStoredAnalysis = read;
  }

  assert.equal(await analyzeCreatedEntry(owner.id, entry.id, provider), "saved");
  assert.equal(await prisma.journalAnalysis.count({ where: { journalEntryId: entry.id } }), 1);
  await prisma.journalAnalysis.deleteMany({ where: { journalEntryId: entry.id } });
  for (const invalidProvider of [
    {
      analyze: async () => {
        throw new Error("private provider failure");
      },
    },
    { analyze: async () => ({ ...valid, confidence: 99 }) },
  ]) {
    assert.equal(await analyzeCreatedEntry(owner.id, entry.id, invalidProvider), "failed");
    assert.equal(await prisma.journalAnalysis.count({ where: { journalEntryId: entry.id } }), 0);
  }
  assert.equal(
    await analyzeCreatedEntry(owner.id, entry.id, {
      analyze: async () => {
        await prisma.userSettings.update({
          where: { userId: owner.id },
          data: { aiConsent: false },
        });
        return valid;
      },
    }),
    "skipped"
  );
  await prisma.userSettings.update({ where: { userId: owner.id }, data: { aiConsent: true } });
  assert.equal(
    await analyzeCreatedEntry(owner.id, entry.id, {
      analyze: async () => {
        await prisma.journalEntry.update({
          where: { id: entry.id },
          data: { content: "Edited", updatedAt: new Date(Date.now() + 1000) },
        });
        return valid;
      },
    }),
    "skipped"
  );
  assert.equal(await prisma.journalAnalysis.count({ where: { journalEntryId: entry.id } }), 0);
  const save = repository.persistAnalysis;
  repository.persistAnalysis = async () => {
    throw new Error("storage unavailable");
  };
  try {
    assert.equal(
      await analyzeCreatedEntry(owner.id, entry.id, { analyze: async () => valid }),
      "failed"
    );
    const savedDespiteFailure = await createEntry(
      owner,
      { content: "Another entry", moodScore: 5 },
      true
    );
    assert.ok(savedDespiteFailure.id);
  } finally {
    repository.persistAnalysis = save;
  }
  assert.equal(
    await analyzeCreatedEntry(owner.id, entry.id, { analyze: async () => valid }),
    "saved"
  );
  await prisma.journalEntry.delete({ where: { id: entry.id } });
  assert.equal(await prisma.journalAnalysis.count({ where: { journalEntryId: entry.id } }), 0);
  const deletedDuringAnalysis = await createEntry(
    owner,
    { content: "Temporary", moodScore: 5 },
    true
  );
  assert.equal(
    await analyzeCreatedEntry(owner.id, deletedDuringAnalysis.id, {
      analyze: async () => {
        await prisma.journalEntry.delete({ where: { id: deletedDuringAnalysis.id } });
        return valid;
      },
    }),
    "skipped"
  );
  console.log(
    "PASS: journal creation survives AI failure; consent/ownership, validated persistence, idempotency, storage errors, consent withdrawal, stale/deleted source and cascade deletion."
  );
} finally {
  if (originalProvider === undefined) delete process.env.AI_JOURNAL_PROVIDER;
  else process.env.AI_JOURNAL_PROVIDER = originalProvider;
  await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  await prisma.$disconnect();
  console.log("Disposable analysis test accounts removed.");
}
