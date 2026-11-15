import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import ts from "typescript";
const cache = new Map();
function load(filename) {
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
        ? load(resolve(dirname(filename), specifier + ".ts"))
        : require(specifier),
    exports
  );
  return exports;
}
const { parseServerEnv } = load(resolve("src/server/env/schema.ts"));
const { publicEnv } = load(resolve("src/lib/env/public.ts"));
const fixture = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://user:password@postgres:5432/journal",
  AUTH_SECRET: "synthetic-test-secret-with-32-characters",
  AUTH_URL: "http://localhost:3000",
  JOURNAL_ENCRYPTION_ENV: "test",
  JOURNAL_KEY_PROVIDER: "development",
  JOURNAL_DEVELOPMENT_WRAPPING_KEY: Buffer.alloc(32, 7).toString("base64"),
};
let checks = 0;
function rejects(patch, field) {
  assert.throws(
    () => parseServerEnv({ ...fixture, ...patch }),
    (error) => {
      assert.ok(error.message.startsWith("Invalid VibeJournal environment configuration:"));
      assert.ok(error.message.includes(field));
      assert.ok(!error.message.includes(fixture.AUTH_SECRET));
      assert.ok(!error.message.includes(fixture.JOURNAL_DEVELOPMENT_WRAPPING_KEY));
      return true;
    }
  );
  checks++;
}
for (const key of [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "JOURNAL_ENCRYPTION_ENV",
  "JOURNAL_KEY_PROVIDER",
  "JOURNAL_DEVELOPMENT_WRAPPING_KEY",
]) {
  rejects({ [key]: undefined }, key);
  rejects({ [key]: "" }, key);
}
const parsed = parseServerEnv({
  ...fixture,
  REDIS_URL: "",
  AI_JOURNAL_PROVIDER: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  AI_JOURNAL_TIMEOUT_MS: undefined,
});
assert.equal(parsed.REDIS_URL, undefined);
assert.equal(parsed.AI_JOURNAL_TIMEOUT_MS, 30000);
assert.equal(parsed.JOURNAL_DATA_KEY_VERSION, 1);
assert.equal(Object.isFrozen(parsed), true);
checks++;
rejects({ DATABASE_URL: "https://example.invalid" }, "DATABASE_URL");
rejects({ AUTH_URL: "http://user:secret@example.invalid/path" }, "AUTH_URL");
rejects({ AUTH_SECRET: "short" }, "AUTH_SECRET");
rejects({ REDIS_URL: "https://example.invalid" }, "REDIS_URL");
rejects({ GOOGLE_CLIENT_ID: "id" }, "GOOGLE_CLIENT_SECRET");
rejects({ GOOGLE_CLIENT_SECRET: "secret" }, "GOOGLE_CLIENT_ID");
rejects({ AI_JOURNAL_PROVIDER: "anthropic" }, "ANTHROPIC_API_KEY");
rejects({ AI_JOURNAL_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "secret" }, "AI_JOURNAL_MODEL");
rejects({ AI_JOURNAL_PROVIDER: "unknown" }, "AI_JOURNAL_PROVIDER");
for (const value of ["", "NaN", "0", "1.5", "120001"])
  rejects({ AI_JOURNAL_TIMEOUT_MS: value }, "AI_JOURNAL_TIMEOUT_MS");
for (const value of ["", "0", "1.5", "9007199254740992"])
  rejects({ JOURNAL_DATA_KEY_VERSION: value }, "JOURNAL_DATA_KEY_VERSION");
rejects({ PROFILE_DATABASE: "true" }, "PROFILE_DATABASE");
rejects({ NODE_ENV: "production" }, "JOURNAL_KEY_PROVIDER");
rejects({ JOURNAL_KEY_PROVIDER: "aws-kms" }, "AWS_REGION");
rejects({ JOURNAL_KEY_PROVIDER: "aws-kms", AWS_REGION: "us-east-1" }, "JOURNAL_KMS_KEY_ID");
rejects(
  { JOURNAL_DEVELOPMENT_WRAPPING_KEY: Buffer.alloc(31).toString("base64") },
  "JOURNAL_DEVELOPMENT_WRAPPING_KEY"
);
rejects(
  { JOURNAL_DEVELOPMENT_WRAPPING_KEY: fixture.JOURNAL_DEVELOPMENT_WRAPPING_KEY + "=" },
  "JOURNAL_DEVELOPMENT_WRAPPING_KEY"
);
rejects({ NEXT_PUBLIC_AUTH_SECRET: "DO_NOT_ECHO_PUBLIC_SECRET" }, "NEXT_PUBLIC_AUTH_SECRET");
try {
  parseServerEnv({
    ...fixture,
    DATABASE_URL: "DO_NOT_ECHO_DATABASE",
    REDIS_URL: "DO_NOT_ECHO_REDIS",
    NEXT_PUBLIC_AUTH_SECRET: "DO_NOT_ECHO_PUBLIC_SECRET",
  });
} catch (error) {
  assert.ok(!error.message.includes("DO_NOT_ECHO_"));
  assert.equal(error.cause, undefined);
  checks++;
}
const production = parseServerEnv({
  ...fixture,
  NODE_ENV: "production",
  JOURNAL_KEY_PROVIDER: "aws-kms",
  JOURNAL_DEVELOPMENT_WRAPPING_KEY: undefined,
  AWS_REGION: "us-east-1",
  JOURNAL_KMS_KEY_ID: "arn:aws:kms:us-east-1:123456789012:key/test",
  REDIS_URL: "rediss://redis:6380",
  AI_JOURNAL_PROVIDER: "anthropic",
  ANTHROPIC_API_KEY: "synthetic",
  AI_JOURNAL_MODEL: "model",
  AI_JOURNAL_TIMEOUT_MS: "15000",
  JOURNAL_DATA_KEY_VERSION: "2",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
});
assert.equal(production.AI_JOURNAL_TIMEOUT_MS, 15000);
assert.equal(production.JOURNAL_DATA_KEY_VERSION, 2);
assert.deepEqual(publicEnv, {});
assert.ok(!JSON.stringify(publicEnv).includes("SECRET"));
checks++;
console.log(
  `PASS: ${checks} environment validation cases; required settings, provider dependencies, typed coercion, public allowlist, and value redaction.`
);
