// Run after npm run build. Exercises real next start without calling external providers.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
const port = process.env.ENV_TEST_PORT || "3188";
const origin = `http://127.0.0.1:${port}`;
const secret = "DO_NOT_LOG_THIS_SYNTHETIC_AUTH_SECRET_123456789";
const env = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://vibejournal:vibejournal_local_only@127.0.0.1:55432/vibejournal",
  AUTH_SECRET: secret,
  AUTH_URL: origin,
  REDIS_URL: "",
  JOURNAL_ENCRYPTION_ENV: "startup-test",
  JOURNAL_KEY_PROVIDER: "aws-kms",
  AWS_REGION: "us-east-1",
  JOURNAL_KMS_KEY_ID: "arn:aws:kms:us-east-1:123456789012:key/test",
  JOURNAL_DEVELOPMENT_WRAPPING_KEY: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  AI_JOURNAL_PROVIDER: "",
  ANTHROPIC_API_KEY: "",
  AI_JOURNAL_MODEL: "",
  AI_JOURNAL_TIMEOUT_MS: "30000",
  JOURNAL_DATA_KEY_VERSION: "1",
  PROFILE_DATABASE: "0",
};
async function run(patch, expectedError) {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", port], {
    env: { ...env, ...patch },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (x) => (output += x));
  child.stderr.on("data", (x) => (output += x));
  const exited = once(child, "exit");
  try {
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null || output.includes("Ready in")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (expectedError) {
      if (child.exitCode === null)
        await Promise.race([
          exited,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Invalid configuration did not terminate startup")),
              5000
            )
          ),
        ]);
      assert.notEqual(child.exitCode, 0);
      assert.ok(output.includes("Invalid VibeJournal environment configuration:"));
      assert.ok(output.includes(expectedError));
      assert.ok(!output.includes("Ready in"), "server must not become ready");
    } else {
      assert.ok(output.includes("Ready in"), "valid runtime configuration starts");
      const response = await fetch(origin + "/api/auth/me");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).user, null);
    }
    assert.ok(!output.includes(secret));
    assert.ok(!output.includes("DO_NOT_LOG_REDIS_VALUE"));
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await exited;
  }
}
await run({ AUTH_SECRET: "" }, "AUTH_SECRET");
await run({ REDIS_URL: "DO_NOT_LOG_REDIS_VALUE" }, "REDIS_URL");
await run(
  {
    JOURNAL_KEY_PROVIDER: "development",
    JOURNAL_DEVELOPMENT_WRAPPING_KEY: Buffer.alloc(32, 3).toString("base64"),
  },
  "Production requires aws-kms"
);
await run({ NEXT_PUBLIC_AUTH_SECRET: secret }, "NEXT_PUBLIC_AUTH_SECRET");
await run({});
console.log(
  "PASS: next start rejects four invalid configurations before readiness, redacts values, and serves with valid runtime configuration."
);
