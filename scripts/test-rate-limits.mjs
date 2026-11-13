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
const { consumeRateLimit, rateLimitKey, rateLimitPolicies } = loadTypeScript(
  resolve("src/server/rate-limit.ts")
);
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const accounts = [],
  keys = new Set();
function key(scope, id) {
  const value = rateLimitKey(scope, id);
  keys.add(value);
  return value;
}
async function seed(scope, id) {
  const bucket = key(scope, id);
  await prisma.authRateLimit.upsert({
    where: { key: bucket },
    create: {
      key: bucket,
      attempts: rateLimitPolicies[scope].limit,
      resetAt: new Date(Date.now() + rateLimitPolicies[scope].seconds * 1000),
    },
    update: {
      attempts: rateLimitPolicies[scope].limit,
      resetAt: new Date(Date.now() + rateLimitPolicies[scope].seconds * 1000),
    },
  });
}
async function call(account, path, method = "POST", body = {}, expected = 200) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(account?.cookie ? { Cookie: account.cookie } : {}),
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
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
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  if (expected === 429) {
    assert.ok(Number(response.headers.get("retry-after")) > 0);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(typeof data.error === "string" ? data.code : data.error.code, "RATE_LIMITED");
  }
  return data;
}
try {
  const concurrentId = "quota-" + randomUUID();
  key("music", concurrentId);
  const results = await Promise.all(
    Array.from({ length: 25 }, () => consumeRateLimit("music", concurrentId))
  );
  assert.equal(results.filter((result) => result.allowed).length, 20);
  const before = await prisma.authRateLimit.findUnique({
    where: { key: key("music", concurrentId) },
  });
  assert.equal((await consumeRateLimit("music", concurrentId)).allowed, false);
  assert.equal(
    (
      await prisma.authRateLimit.findUnique({ where: { key: key("music", concurrentId) } })
    ).resetAt.getTime(),
    before.resetAt.getTime()
  );
  await prisma.authRateLimit.update({
    where: { key: key("music", concurrentId) },
    data: { resetAt: new Date(0) },
  });
  assert.equal((await consumeRateLimit("music", concurrentId)).allowed, true);
  assert.equal(
    (await prisma.authRateLimit.findUnique({ where: { key: key("music", concurrentId) } }))
      .attempts,
    1
  );

  const account = { email: `quota-test-${randomUUID()}@example.invalid`, password: randomUUID() };
  accounts.push(account);
  account.id = (await call(account, "/api/auth/signup", "POST", account)).user.id;
  for (const scope of ["login", "register", "reset"]) key(scope, account.email);
  await seed("register", account.email);
  await call(
    null,
    "/api/auth/signup",
    "POST",
    { email: account.email, password: account.password },
    429
  );
  await seed("reset", account.email);
  await call(null, "/api/auth/password-reset/request", "POST", { email: account.email }, 429);
  await seed("login", account.email);
  await call(
    null,
    "/api/auth/login",
    "POST",
    { email: account.email, password: account.password },
    429
  );
  const csrf = await call(account, "/api/auth/csrf", "GET");
  const native = await fetch(origin + "/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: account.cookie,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({
      email: account.email,
      password: account.password,
      csrfToken: csrf.csrfToken,
      callbackUrl: origin + "/dashboard",
    }),
  });
  assert.equal(native.status, 429);
  assert.ok(Number(native.headers.get("retry-after")) > 0);

  const entry = (
    await call(
      account,
      "/api/journal",
      "POST",
      { content: "Rate limit fixture", moodScore: 5, energyScore: 5 },
      201
    )
  ).entry;
  await seed("music", account.id);
  await call(account, "/api/music", "POST", { intent: "calm", timeOfDay: "night" }, 429);
  await call(account, "/api/settings", "PATCH", { aiConsent: true });
  await seed("ai-user", account.id);
  await call(account, "/api/journal/" + entry.id + "/analysis", "POST", {}, 429);
  const saved = await call(
    account,
    "/api/journal",
    "POST",
    { content: "Must still save", moodScore: 5 },
    201
  );
  assert.equal(saved.entry.analysisStatus, "rate_limited");
  assert.ok(await prisma.journalEntry.findUnique({ where: { id: saved.entry.id } }));
  assert.equal(
    await prisma.journalAnalysis.count({ where: { journalEntryId: saved.entry.id } }),
    0
  );
  for (const age of [1, 2])
    await prisma.journalEntry.create({
      data: {
        userId: account.id,
        content: "Weekly quota fixture",
        moodScore: 5,
        createdAt: new Date(Date.now() - age * 86400000),
      },
    });
  key("ai-weekly", account.id);
  await call(account, "/api/weekly-reflection", "POST", {}, 429);
  await seed("ai-weekly", account.id);
  await call(account, "/api/weekly-reflection", "POST", {}, 429);
  const isolated = "other-" + randomUUID();
  key("ai-user", isolated);
  assert.equal((await consumeRateLimit("ai-user", isolated)).allowed, true);
  console.log(
    "PASS: atomic concurrent quotas, fixed reset time, expiry recovery, scope/user isolation, auth/native Auth.js 429s, music and AI 429 headers, shared AI budget and journal-save preservation."
  );
} finally {
  await prisma.user.deleteMany({
    where: { email: { in: accounts.map((account) => account.email) } },
  });
  await prisma.authRateLimit.deleteMany({ where: { key: { in: [...keys] } } });
  await prisma.$disconnect();
  console.log("Disposable users and quota buckets removed.");
}
