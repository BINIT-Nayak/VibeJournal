import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { resolve, dirname } from "node:path";
import { createClient } from "redis";
import ts from "typescript";

// Dedicated ephemeral Redis: no credentials, production data, or persistence.
const socket = createServer();
socket.listen(0, "127.0.0.1");
await once(socket, "listening");
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const server = spawn(process.env.REDIS_SERVER_BIN || "redis-server", [
  "--bind",
  "127.0.0.1",
  "--port",
  String(port),
  "--save",
  "",
  "--appendonly",
  "no",
]);
await new Promise((resolve, reject) => {
  server.on("error", reject);
  server.on("exit", (code) => reject(new Error(`Redis exited: ${code}`)));
  server.stdout.on("data", (chunk) => {
    if (chunk.toString().includes("Ready to accept connections")) resolve();
  });
});
process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
const admin = createClient({ url: process.env.REDIS_URL });
admin.on("error", () => {});
await admin.connect();
const modules = new Map();
function load(filename) {
  if (modules.has(filename)) return modules.get(filename);
  const exports = {};
  modules.set(filename, exports);
  const require = createRequire(filename);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  new Function("require", "exports", compiled.outputText)((specifier) => {
    if (specifier.startsWith("@/")) return load(resolve("src", specifier.slice(2) + ".ts"));
    if (specifier.startsWith(".")) return load(resolve(dirname(filename), specifier + ".ts"));
    return require(specifier);
  }, exports);
  return exports;
}
try {
  const { cachedAnalytics, invalidateAnalytics } = load(resolve("src/server/analytics/cache.ts"));
  let calculations = 0;
  const compute = async () => ({
    period: { startDate: "2026-11-01", endDate: "2026-11-13" },
    statistics: { journalCount: ++calculations },
    insights: [],
    correlations: [],
    sleepComparison: {},
    exerciseComparison: {},
  });
  const read = (user = "a", start = "2026-11-01") =>
    cachedAnalytics(user, start, "2026-11-13", compute);
  assert.equal((await read()).statistics.journalCount, 1);
  assert.equal((await read()).statistics.journalCount, 1);
  await read("b");
  await read("a", "2026-11-07");
  assert.equal(calculations, 3, "separate users and ranges");
  await invalidateAnalytics("a");
  await read();
  assert.equal(calculations, 4);
  assert.equal((await read("b")).statistics.journalCount, 2, "other users remain cached");
  await read("a", "2026-11-07");
  assert.equal(calculations, 5, "all ranges invalidated");

  await invalidateAnalytics("a");
  let release;
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const pending = cachedAnalytics("a", "2026-11-01", "2026-11-13", async () => {
    started();
    await new Promise((resolve) => {
      release = resolve;
    });
    return compute();
  });
  await ready;
  await invalidateAnalytics("a");
  release();
  await pending;
  const before = calculations;
  await read();
  assert.equal(calculations, before + 1, "stale computation cannot refill current generation");
  const keys = await admin.keys("vibejournal:analytics:*");
  const results = keys.filter((key) => key.includes(":UTC:"));
  assert.ok(results.length);
  for (const key of results) {
    const ttl = await admin.ttl(key);
    assert.ok(ttl > 0 && ttl <= 300);
    await admin.expire(key, 1);
  }
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const beforeExpiry = calculations;
  await read();
  assert.equal(calculations, beforeExpiry + 1, "expired result recomputes");
  for (const key of await admin.keys("*:UTC:*")) await admin.set(key, "broken JSON", { EX: 300 });
  const beforeCorrupt = calculations;
  await read();
  assert.equal(calculations, beforeCorrupt + 1, "corrupt cache recomputes");
  // Exercise the real service boundaries with deterministic repositories.
  let reads = 0;
  modules.set(resolve("src/server/analytics/repository.ts"), {
    readAnalytics: async () => {
      reads++;
      return { daily: [], pairs: [], tags: [] };
    },
  });
  const { getAnalytics } = load(resolve("src/server/analytics/service.ts"));
  const actor = { id: "service-owner" };
  const analytics = () => getAnalytics(actor, { days: "7" });
  await analytics();
  await analytics();
  assert.equal(reads, 1, "analytics service skips repository on cache hits");
  const entry = { id: "entry", updatedAt: new Date("2026-11-01T00:00:00Z") };
  let failWrite = false;
  modules.set(resolve("src/server/journal/repository.ts"), {
    create: async () => {
      if (failWrite) throw new Error("write failed");
      return entry;
    },
    findByOwner: async () => entry,
    updateByOwner: async () => entry,
    deleteByOwner: async () => ({ count: 1 }),
    deleteAllByOwner: async () => ({ count: 1 }),
  });
  modules.set(resolve("src/server/api.ts"), { serializeEntry: (value) => value });
  modules.set(resolve("src/server/journal-analysis/after-create.ts"), {
    analyzeCreatedEntry: async () => "skipped",
  });
  const journal = load(resolve("src/server/journal/service.ts"));
  const mutations = [
    () => journal.createEntry(actor, { content: "Test", moodScore: 5 }),
    () =>
      journal.updateEntry(actor, "entry", {
        tags: ["rest"],
        expectedUpdatedAt: entry.updatedAt.toISOString(),
      }),
    () =>
      journal.updateEntry(actor, "entry", {
        archived: true,
        expectedUpdatedAt: entry.updatedAt.toISOString(),
      }),
    () =>
      journal.updateEntry(actor, "entry", {
        archived: false,
        expectedUpdatedAt: entry.updatedAt.toISOString(),
      }),
    () => journal.deleteEntry(actor, "entry"),
    () => journal.deleteAllEntries(actor),
  ];
  for (const mutate of mutations) {
    const previousReads = reads;
    await mutate();
    await analytics();
    assert.equal(reads, previousReads + 1, "successful journal mutations invalidate analytics");
  }
  failWrite = true;
  await assert.rejects(journal.createEntry(actor, { content: "Test", moodScore: 5 }));
  const previousReads = reads;
  await analytics();
  assert.equal(reads, previousReads, "failed writes preserve valid cache");
  // Real Redis + real limiter service, deterministic durable-ledger double.
  process.env.AUTH_SECRET = "redis-integration-test-only-secret";
  let ledgerCalls = 0;
  const ledger = new Map();
  modules.set(resolve("src/server/db.ts"), {
    prisma: {
      $queryRaw: async (sql, key) => {
        ledgerCalls++;
        const attempts = (ledger.get(key) || 0) + 1;
        ledger.set(key, attempts);
        return [{ attempts, retryAfter: 15 }];
      },
    },
  });
  const limiter = load(resolve("src/server/rate-limit.ts"));
  for (let i = 0; i < 10; i++) {
    assert.equal((await limiter.consumeRateLimit("login", "limited-user")).allowed, true);
  }
  assert.equal((await limiter.consumeRateLimit("login", "limited-user")).allowed, false);
  const blockedCalls = ledgerCalls;
  const blocks = await admin.keys("vibejournal:rate-limit:*");
  assert.equal(blocks.length, 1);
  const ttlBefore = await admin.pTTL(blocks[0]);
  assert.ok(ttlBefore > 0 && ttlBefore <= 14000);
  const blocked = await Promise.all(
    Array.from({ length: 20 }, () => limiter.consumeRateLimit("login", "limited-user"))
  );
  assert.ok(blocked.every((result) => !result.allowed && result.retryAfter > 0));
  assert.equal(ledgerCalls, blockedCalls, "Redis absorbs repeated denials without ledger queries");
  assert.ok((await admin.pTTL(blocks[0])) <= ttlBefore, "denials never extend TTL");
  await limiter.rateLimitRetryAfter("login", "limited-user");
  assert.equal(ledgerCalls, blockedCalls, "retry header uses Redis TTL");
  assert.equal((await limiter.consumeRateLimit("login", "different-user")).allowed, true);
  assert.equal((await limiter.consumeRateLimit("music", "limited-user")).allowed, true);
  await admin.del(blocks);
  assert.equal(
    (await limiter.consumeRateLimit("login", "limited-user")).allowed,
    false,
    "Redis eviction does not reset the durable quota"
  );
  const redisUrl = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  assert.equal(
    (await limiter.consumeRateLimit("login", "limited-user")).allowed,
    false,
    "missing Redis configuration still enforces durable quota"
  );
  assert.equal((await limiter.consumeRateLimit("login", "unconfigured-user")).allowed, true);
  process.env.REDIS_URL = redisUrl;
  await admin.quit();
  server.kill("SIGTERM");
  await once(server, "exit");
  assert.equal(
    (await limiter.consumeRateLimit("login", "limited-user")).allowed,
    false,
    "Redis outage cannot grant another quota"
  );
  assert.equal(
    (await limiter.consumeRateLimit("login", "outage-user")).allowed,
    true,
    "Redis outage does not prevent valid requests"
  );
  const beforeOutage = calculations;
  await read();
  await invalidateAnalytics("a");
  assert.equal(
    calculations,
    beforeOutage + 1,
    "outage falls back and invalidation does not fail writes"
  );
  console.log(
    "PASS: Redis hits, user/range isolation, all-range invalidation, concurrent stale-fill prevention, TTL expiry, corrupt data, Redis rate-limit denials and durable outage fallback."
  );
} finally {
  if (admin.isOpen) admin.destroy();
  if (server.exitCode === null) server.kill("SIGTERM");
}
