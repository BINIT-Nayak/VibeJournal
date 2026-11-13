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

const { default: nextEnv } = await import("@next/env");
nextEnv.loadEnvConfig(process.cwd());
const { randomUUID } = await import("node:crypto");
const { prisma } = loadTypeScript(resolve("src/server/db.ts"));
const { getMusicSource, getMusicRecommendations } = loadTypeScript(
  resolve("src/server/music/service.ts")
);
const { createItunesProvider } = loadTypeScript(resolve("src/server/music/itunes.ts"));
const { recommendMusicCriteria } = loadTypeScript(
  resolve("src/features/music/recommendation-service.ts")
);
const users = [];
const input = { intent: "calm", timeOfDay: "night" };
try {
  for (let i = 0; i < 2; i++)
    users.push(
      await prisma.user.create({ data: { email: `music-test-${randomUUID()}@example.invalid` } })
    );
  const [owner, other] = users;
  let calls = 0,
    captured;
  const provider = {
    recommend: async (criteria) => {
      calls++;
      captured = criteria;
      return [];
    },
  };
  assert.equal(await getMusicSource(owner.id), null);
  assert.equal(await getMusicRecommendations(owner.id, input, undefined, provider), null);
  assert.equal(calls, 0);
  const entry = await prisma.journalEntry.create({
    data: { userId: owner.id, content: "PRIVATE_MUSIC_JOURNAL", moodScore: 3, energyScore: null },
  });
  await prisma.journalEntry.create({
    data: { userId: other.id, content: "FOREIGN_TEXT", moodScore: 10, energyScore: 10 },
  });
  await prisma.journalEntry.create({
    data: { userId: owner.id, content: "ARCHIVED", moodScore: 10, archivedAt: new Date() },
  });
  await prisma.journalEntry.create({
    data: {
      userId: owner.id,
      content: "FUTURE",
      moodScore: 10,
      createdAt: new Date(Date.now() + 86400000),
    },
  });
  assert.equal((await getMusicSource(owner.id)).mood, 3);
  assert.ok(!JSON.stringify(await getMusicSource(owner.id)).includes("PRIVATE"));
  await assert.rejects(
    getMusicRecommendations(owner.id, input, undefined, provider),
    /ENERGY_REQUIRED/
  );
  await getMusicRecommendations(owner.id, { ...input, energy: 4 }, undefined, provider);
  assert.equal(calls, 1);
  assert.equal(captured.intent, "calm");
  assert.ok(!JSON.stringify(captured).includes("PRIVATE"));
  await prisma.journalEntry.update({ where: { id: entry.id }, data: { energyScore: 8 } });
  await getMusicRecommendations(
    owner.id,
    { ...input, intent: "match", energy: 1 },
    undefined,
    provider
  );
  assert.equal(captured.intensity.target, 0.778);
  await assert.rejects(
    getMusicRecommendations(owner.id, { ...input, userId: other.id }, undefined, provider)
  );
  const criteria = recommendMusicCriteria({
    mood: 3,
    energy: 4,
    primaryEmotion: null,
    intent: "calm",
    timeOfDay: "night",
  });
  const track = {
    kind: "song",
    primaryGenreName: "Pop",
    trackExplicitness: "notExplicit",
    trackId: 1,
    trackName: "Quiet Track",
    artistName: "Artist",
    trackViewUrl: "https://music.apple.com/us/album/example/123?i=1",
  };
  const adapter = createItunesProvider(async (url, init) => {
    assert.equal(url.hostname, "itunes.apple.com");
    assert.equal(url.searchParams.get("term"), "ambient piano");
    assert.equal(init.redirect, "error");
    assert.ok(!url.toString().includes("PRIVATE"));
    return Response.json({
      results: [
        track,
        track,
        { ...track, trackId: 2, trackViewUrl: "javascript:alert(1)" },
        { ...track, trackId: 3, trackViewUrl: "https://evil.invalid/" },
      ],
    });
  });
  const tracks = await adapter.recommend(criteria);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].title, "Quiet Track");
  assert.match(tracks[0].reason, /not verified/);
  assert.deepEqual(
    await createItunesProvider(async () => Response.json({ results: [] })).recommend(criteria),
    []
  );
  for (const fetcher of [
    async () => new Response("vendor error", { status: 503 }),
    async () => Response.json({ unexpected: true }),
    async () => {
      throw new Error("network detail");
    },
  ])
    await assert.rejects(
      createItunesProvider(fetcher).recommend(criteria),
      /music provider is unavailable/
    );

  const prefs = {
    favoriteGenres: ["jazz"],
    dislikedGenres: ["rock"],
    preferredLanguages: ["english", "hindi"],
    allowExplicit: false,
  };
  await prisma.userSettings.create({ data: { userId: owner.id, ...prefs } });
  await getMusicRecommendations(owner.id, input, undefined, provider);
  assert.deepEqual(captured.constraints, prefs);
  assert.deepEqual((await getMusicSource(owner.id)).preferences, prefs);
  assert.equal((await getMusicSource(other.id)).preferences.allowExplicit, false);
  const constrained = recommendMusicCriteria(
    { mood: 3, energy: 4, primaryEmotion: null, intent: "calm", timeOfDay: "night" },
    prefs
  );
  const terms = [];
  const preferenceAdapter = createItunesProvider(async (url) => {
    terms.push(url.searchParams.get("term"));
    assert.equal(url.searchParams.get("explicit"), "No");
    return Response.json({
      results: [
        { ...track, trackId: 10, primaryGenreName: "Pop" },
        { ...track, trackId: 11, primaryGenreName: "Jazz" },
        { ...track, trackId: 12, primaryGenreName: "Rock" },
        { ...track, trackId: 13, primaryGenreName: "Jazz", trackExplicitness: "explicit" },
        { ...track, trackId: 14, primaryGenreName: "Jazz", trackExplicitness: undefined },
        { ...track, trackId: 15, primaryGenreName: undefined },
      ],
    });
  });
  const preferred = await preferenceAdapter.recommend(constrained);
  assert.deepEqual(
    preferred.map((item) => item.id),
    ["11", "10"]
  );
  assert.equal(terms.length, 2);
  assert.ok(terms.some((term) => term.includes("hindi")));
  assert.ok(terms.some((term) => term.includes("english")));
  assert.ok(terms.every((term) => term.includes("jazz")));
  assert.match(preferred[0].reason, /matches a favorite/);
  const explicitAdapter = createItunesProvider(async (url) => {
    assert.equal(url.searchParams.get("explicit"), "Yes");
    return Response.json({
      results: [{ ...track, primaryGenreName: "Jazz", trackExplicitness: "explicit" }],
    });
  });
  assert.equal(
    (
      await explicitAdapter.recommend({
        ...constrained,
        constraints: { ...prefs, allowExplicit: true },
      })
    ).length,
    1
  );
  if (process.env.TEST_LIVE_MUSIC === "1") {
    const live = await createItunesProvider().recommend(criteria);
    console.log(`Live catalog returned ${live.length} validated tracks.`);
  }
  console.log(
    "PASS: music owner scope, empty history, missing energy, stored-value precedence, criteria-only provider inputs, catalog validation/deduplication, safe links, empty/error states."
  );
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  await prisma.$disconnect();
  console.log("Disposable music fixtures removed.");
}
