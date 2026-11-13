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

const { recommendMusicCriteria, getMusicTimeOfDay } = loadTypeScript(
  resolve("src/features/music/recommendation-service.ts")
);
const { musicEmotionSchema, musicCriteriaSchema } = loadTypeScript(
  resolve("src/features/music/schemas.ts")
);
const context = {
  mood: 3,
  energy: 2,
  primaryEmotion: "sad",
  intent: "match",
  timeOfDay: "afternoon",
};
const matching = recommendMusicCriteria(context);
assert.equal(matching.positivity.target, 0.222);
assert.equal(matching.intensity.target, 0.111);
assert.ok(matching.descriptors.includes("reflective"));
assert.deepEqual(recommendMusicCriteria(context), matching);
assert.deepEqual(context, {
  mood: 3,
  energy: 2,
  primaryEmotion: "sad",
  intent: "match",
  timeOfDay: "afternoon",
});
const uplift = recommendMusicCriteria({ ...context, intent: "uplift" });
assert.ok(uplift.positivity.target > matching.positivity.target);
assert.ok(uplift.intensity.target > matching.intensity.target);
assert.ok(uplift.intensity.target <= 0.4);
assert.ok(uplift.descriptors.includes("gentle"));
for (const intent of ["match", "uplift", "calm", "focus"]) {
  for (let mood = 1; mood <= 10; mood++) {
    for (let energy = 1; energy <= 10; energy++) {
      for (const primaryEmotion of [...musicEmotionSchema.options, null]) {
        const criteria = recommendMusicCriteria({
          mood,
          energy,
          primaryEmotion,
          intent,
          timeOfDay: "afternoon",
        });
        assert.ok(musicCriteriaSchema.safeParse(criteria).success);
        assert.equal(new Set(criteria.descriptors).size, criteria.descriptors.length);
        if (intent === "calm") {
          assert.ok(criteria.intensity.target <= 0.25);
          assert.ok(criteria.tempoBpm.target <= 70);
          assert.equal(criteria.vocals, "prefer_instrumental");
        }
        if (intent === "focus") {
          assert.ok(criteria.intensity.target >= 0.3 && criteria.intensity.target <= 0.5);
          assert.equal(criteria.vocals, "prefer_instrumental");
          assert.ok(!criteria.descriptors.includes("expressive"));
        }
        if (intent === "uplift") {
          assert.ok(criteria.intensity.target >= Math.round(((energy - 1) / 9) * 1000) / 1000);
        }
      }
    }
  }
}
for (const invalid of [
  null,
  {},
  { ...context, mood: 0 },
  { ...context, mood: 11 },
  { ...context, energy: 0 },
  { ...context, energy: 11 },
  { ...context, mood: 2.5 },
  { ...context, energy: "5" },
  { ...context, energy: NaN },
  { ...context, energy: Infinity },
  { ...context, primaryEmotion: "unknown" },
  { ...context, primaryEmotion: undefined },
  { ...context, intent: "relax" },
  { ...context, content: "private journal text" },
  { ...context, userId: "untrusted" },
])
  assert.throws(() => recommendMusicCriteria(invalid));
assert.equal(recommendMusicCriteria({ ...context, primaryEmotion: null }).intent, "match");
console.log(
  "PASS: deterministic mapping, all intent/emotion/score combinations, bounded ordered ranges, intent precedence, gentle uplift, null emotion and invalid inputs."
);

for (const [hour, expected] of [
  [0, "night"],
  [4, "night"],
  [5, "morning"],
  [11, "morning"],
  [12, "afternoon"],
  [16, "afternoon"],
  [17, "evening"],
  [21, "evening"],
  [22, "night"],
  [23, "night"],
])
  assert.equal(getMusicTimeOfDay(hour), expected);
for (const hour of [-1, 24, 1.5, NaN, Infinity, "12"]) assert.throws(() => getMusicTimeOfDay(hour));
for (const timeOfDay of ["morning", "afternoon", "evening", "night"]) {
  for (const intent of ["match", "uplift", "calm", "focus"]) {
    for (const mood of [1, 5, 10])
      for (const energy of [1, 5, 10]) {
        const result = recommendMusicCriteria({
          mood,
          energy,
          primaryEmotion: "anxious",
          intent,
          timeOfDay,
        });
        assert.ok(musicCriteriaSchema.safeParse(result).success);
        assert.equal(result.timeOfDay, timeOfDay);
        if (intent === "calm") assert.ok(result.intensity.max <= 0.33);
        if (intent === "focus") {
          assert.ok(result.intensity.target >= 0.25 && result.intensity.target <= 0.5);
          assert.equal(result.vocals, "prefer_instrumental");
        }
      }
  }
}
const recommend = (intent, timeOfDay, emotion = "anxious") =>
  recommendMusicCriteria({ mood: 3, energy: 8, primaryEmotion: emotion, intent, timeOfDay });
assert.equal(recommend("calm", "night").intensity.target, 0.2);
assert.deepEqual(recommend("calm", "night").tempoBpm, { min: 55, target: 65, max: 75 });
assert.equal(recommend("focus", "afternoon", "angry").intensity.target, 0.5);
assert.ok(recommend("focus", "afternoon", "angry").descriptors.includes("low_distraction"));
assert.ok(!recommend("focus", "afternoon", "angry").descriptors.includes("expressive"));
assert.ok(
  recommend("uplift", "night").intensity.target < recommend("uplift", "morning").intensity.target
);
assert.ok(
  recommend("uplift", "night").tempoBpm.target < recommend("uplift", "morning").tempoBpm.target
);
assert.ok(recommend("uplift", "afternoon").descriptors.includes("gentle"));
assert.equal(
  recommend("match", "night", "angry").intensity.target,
  recommend("match", "afternoon", "angry").intensity.target
);
assert.throws(() => recommendMusicCriteria({ ...context, timeOfDay: "midnight" }));
assert.throws(() => recommendMusicCriteria({ ...context, timeOfDay: undefined }));
console.log(
  "PASS: local-time boundaries, morning/night adjustments, anxious calm, angry focus, night uplift and normalized bounds across dayparts."
);

const { musicPreferencesSchema, defaultMusicPreferences } = loadTypeScript(
  resolve("src/features/music/preferences.ts")
);
assert.deepEqual(recommendMusicCriteria(context).constraints, defaultMusicPreferences);
const selected = {
  favoriteGenres: ["jazz"],
  dislikedGenres: ["metal"],
  preferredLanguages: ["hindi"],
  allowExplicit: false,
};
assert.deepEqual(recommendMusicCriteria(context, selected).constraints, selected);
for (const value of [
  { ...selected, favoriteGenres: ["metal"] },
  { ...selected, favoriteGenres: ["jazz", "jazz"] },
  { ...selected, preferredLanguages: ["unknown"] },
  { ...selected, preferredLanguages: ["hindi", "english", "tamil", "telugu"] },
  { ...selected, allowExplicit: "false" },
  { ...selected, userId: "other" },
  { ...selected, dislikedGenres: ["jazz"] },
  null,
  {},
])
  assert.equal(musicPreferencesSchema.safeParse(value).success, false);
console.log(
  "PASS: preference defaults, valid constraints, conflicting/duplicate genres, language limits and strict preference values."
);
