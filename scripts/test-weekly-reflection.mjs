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

// Quotas are exercised separately in test:rate-limits.
loadTypeScript(resolve("src/server/rate-limit.ts")).enforceRateLimit = async () => {};
const { default: nextEnv } = await import("@next/env");
nextEnv.loadEnvConfig(process.cwd());
const { randomUUID } = await import("node:crypto");
const { prisma } = loadTypeScript(resolve("src/server/db.ts"));
const { getWeeklyPreview, generateWeeklyReflection } = loadTypeScript(
  resolve("src/server/weekly-reflection/service.ts")
);
const { createAnthropicWeeklyProvider } = loadTypeScript(
  resolve("src/server/weekly-reflection/anthropic.ts")
);
const users = [];
const output = {
  reflection: "A week with room for reflection.",
  observations: ["Some days have no sleep recorded."],
  reflectionPrompt: "What felt worth noticing?",
};
let calls = 0,
  captured;
const provider = {
  reflect: async (summary) => {
    calls++;
    captured = summary;
    return output;
  },
};
try {
  for (const consent of [true, false])
    users.push(
      await prisma.user.create({
        data: {
          email: `weekly-test-${randomUUID()}@example.invalid`,
          settings: { create: { aiConsent: consent } },
        },
      })
    );
  const [owner, other] = users;
  const empty = await getWeeklyPreview(owner.id);
  assert.equal(empty.eligible, false);
  assert.equal(empty.summary.days.length, 7);
  assert.equal(empty.summary.averageMood, null);
  assert.ok(empty.summary.days.every((day) => day.averageMood === null));
  await assert.rejects(generateWeeklyReflection(owner.id, undefined, provider), {
    code: "INSUFFICIENT_DATA",
  });
  await assert.rejects(generateWeeklyReflection(other.id, undefined, provider), {
    code: "CONSENT_REQUIRED",
  });
  assert.equal(calls, 0);
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  async function add(age, moodScore, sleepHours, exercised, account = owner, extra = {}) {
    const entry = await prisma.journalEntry.create({
      data: {
        userId: account.id,
        content: "RAW_TEXT_MUST_NEVER_LEAVE",
        title: "PRIVATE_TITLE",
        voiceNote: "PRIVATE_TRANSCRIPT",
        moodScore,
        sleepHours,
        exercised,
        createdAt: new Date(start - age * 86400000),
        ...extra,
      },
    });
    await prisma.journalAnalysis.create({
      data: {
        journalEntryId: entry.id,
        userId: account.id,
        sourceUpdatedAt: entry.updatedAt,
        primaryEmotion: "calm",
        emotions: ["calm"],
        sentimentScore: 0,
        themes: ["work"],
        estimatedEnergy: 5,
        reflectionPrompt: "PRIVATE_PROMPT",
        confidence: 0.5,
      },
    });
    return entry;
  }
  await add(0, 2, 6, true);
  await add(1, 4, 8, false);
  await add(2, 6, null, null);
  const duplicate = await add(0, 10, null, false);
  await prisma.journalAnalysis.delete({ where: { journalEntryId: duplicate.id } });
  await add(7, 10, 24, true);
  await add(-1, 10, 24, true);
  await add(3, 10, 24, true, owner, { archivedAt: now });
  await add(0, 1, 1, false, other);
  const result = await generateWeeklyReflection(owner.id, undefined, provider);
  assert.deepEqual(result.reflection, output);
  assert.equal(captured.journalCount, 4);
  assert.equal(captured.recordedDays, 3);
  assert.equal(captured.averageMood, 5.5);
  assert.equal(captured.days[6].averageMood, 6);
  assert.equal(captured.sleep.averageHours, 7);
  assert.equal(captured.sleep.missingEntries, 2);
  assert.deepEqual(captured.exercise, {
    exerciseDays: 0,
    nonExerciseDays: 1,
    unknownDays: 5,
    conflictingDays: 1,
  });
  assert.deepEqual(captured.topThemes, [{ theme: "work", entries: 3, days: 3 }]);
  assert.ok(!/RAW_TEXT|PRIVATE_|content|userId|title/.test(JSON.stringify(captured)));
  await assert.rejects(
    generateWeeklyReflection(owner.id, undefined, {
      reflect: async () => ({ ...output, extra: "bad" }),
    })
  );
  await assert.rejects(
    generateWeeklyReflection(owner.id, undefined, {
      reflect: async () => {
        await prisma.userSettings.update({
          where: { userId: owner.id },
          data: { aiConsent: false },
        });
        return output;
      },
    }),
    { code: "CONSENT_REQUIRED" }
  );
  const before = calls;
  await assert.rejects(generateWeeklyReflection(owner.id, undefined, provider), {
    code: "CONSENT_REQUIRED",
  });
  assert.equal(calls, before);
  // Verify the actual HTTP adapter sends only the strict summary and validates responses.
  const config = { apiKey: "test-key", model: "test-model", timeoutMs: 1000 };
  const transport = createAnthropicWeeklyProvider(config, async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(JSON.parse(body.messages[0].content), captured);
    assert.ok(!/RAW_TEXT|PRIVATE_/.test(init.body));
    return Response.json({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(output) }],
    });
  });
  assert.deepEqual(await transport.reflect(captured), output);
  await assert.rejects(transport.reflect({ ...captured, content: "RAW_TEXT" }), {
    code: "INVALID_ANALYSIS_INPUT",
  });
  for (const envelope of [
    { stop_reason: "max_tokens", content: [{ type: "text", text: JSON.stringify(output) }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: '{"reflection":true}' }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "not JSON" }] },
  ]) {
    const bad = createAnthropicWeeklyProvider(config, async () => Response.json(envelope));
    await assert.rejects(bad.reflect(captured), { code: "INVALID_JOURNAL_ANALYSIS" });
  }
  console.log(
    "PASS: weekly empty/sparse summaries, gaps, averages, exercise unknown/conflicts, recurring themes, exclusions, consent, compact-only transport and strict output validation."
  );
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  await prisma.$disconnect();
  console.log("Disposable weekly-reflection fixtures removed.");
}
