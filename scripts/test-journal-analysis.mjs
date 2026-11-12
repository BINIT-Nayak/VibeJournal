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
      specifier.startsWith(".")
        ? loadTypeScript(resolve(dirname(filename), specifier + ".ts"))
        : require(specifier),
    exports
  );
  return exports;
}
const { validateJournalAnalysis, InvalidJournalAnalysisError } = loadTypeScript(
  resolve("src/server/journal-analysis/validation.ts")
);
const valid = {
  primaryEmotion: "hopeful",
  emotions: ["hopeful", "anxious"],
  sentimentScore: 0.3,
  themes: ["Work", "Change"],
  estimatedEnergy: 6,
  reflectionPrompt: "What felt within your control today?",
  confidence: 0.7,
};
assert.deepEqual(validateJournalAnalysis(valid), valid);
assert.deepEqual(validateJournalAnalysis(JSON.stringify(valid)), valid);
assert.equal(
  validateJournalAnalysis({ ...valid, reflectionPrompt: "  A question?  " }).reflectionPrompt,
  "A question?"
);
for (const field of Object.keys(valid)) {
  const missing = { ...valid };
  delete missing[field];
  assert.throws(() => validateJournalAnalysis(missing), InvalidJournalAnalysisError);
  assert.throws(
    () => validateJournalAnalysis({ ...valid, [field]: null }),
    InvalidJournalAnalysisError
  );
}
const invalid = [
  undefined,
  null,
  [],
  1,
  true,
  "",
  "not JSON",
  '{"broken":',
  JSON.stringify(valid) + " trailing text",
  "\u0060\u0060\u0060json\n" + JSON.stringify(valid) + "\n\u0060\u0060\u0060",
  " ".repeat(16001),
  { ...valid, userId: "injected" },
  { ...valid, primaryEmotion: "diagnosis" },
  { ...valid, emotions: [] },
  { ...valid, emotions: ["calm"] },
  { ...valid, emotions: ["hopeful", "hopeful"] },
  { ...valid, emotions: ["hopeful", "calm", "sad", "angry", "tired", "neutral"] },
  { ...valid, emotions: [{ emotion: "hopeful" }] },
  { ...valid, themes: [" "] },
  { ...valid, themes: ["Work", " work "] },
  { ...valid, themes: ["x".repeat(81)] },
  { ...valid, themes: Array.from({ length: 9 }, (_, i) => String(i)) },
  { ...valid, reflectionPrompt: " " },
  { ...valid, reflectionPrompt: "x".repeat(501) },
];
for (const field of ["sentimentScore", "estimatedEnergy", "confidence"]) {
  for (const value of [NaN, Infinity, -Infinity, "1", true, {}, -2, 11]) {
    invalid.push({ ...valid, [field]: value });
  }
}
invalid.push(
  { ...valid, estimatedEnergy: 1.5 },
  { ...valid, estimatedEnergy: 0 },
  { ...valid, confidence: -0.1 },
  { ...valid, confidence: 1.1 },
  { ...valid, sentimentScore: -1.1 },
  { ...valid, sentimentScore: 1.1 }
);
for (const value of invalid) {
  assert.throws(
    () => validateJournalAnalysis(value),
    (error) =>
      error instanceof InvalidJournalAnalysisError &&
      error.code === "INVALID_JOURNAL_ANALYSIS" &&
      error.message === "The journal analysis response was invalid."
  );
}
for (const sentimentScore of [-1, 0, 1]) {
  for (const confidence of [0, 1]) {
    for (const estimatedEnergy of [1, 10]) {
      validateJournalAnalysis({
        ...valid,
        sentimentScore,
        confidence,
        estimatedEnergy,
        themes: [],
      });
    }
  }
}
console.log(
  "PASS: structured AI output, strict fields, required values, numeric bounds, enums, consistency, uniqueness, text limits, raw JSON and safe failures."
);
