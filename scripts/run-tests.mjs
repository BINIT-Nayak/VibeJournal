import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
const mode = process.argv[2];
if (!["integration", "e2e"].includes(mode)) throw new Error("Choose integration or e2e.");
const database =
  process.env.TEST_DATABASE_URL ||
  "postgresql://vibejournal_test:test_only_password@127.0.0.1:55433/vibejournal_test?schema=public";
const url = new URL(database);
if (
  url.pathname !== "/vibejournal_test" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
)
  throw new Error("Tests require a local dedicated database named vibejournal_test.");
const origin = "http://127.0.0.1:3200";
const env = {
  ...process.env,
  NODE_ENV: "development",
  VIBEJOURNAL_TEST_SERVER: "1",
  DATABASE_URL: database,
  AUTH_URL: origin,
  TEST_APP_URL: origin,
  AUTH_SECRET: randomBytes(48).toString("base64"),
  JOURNAL_ENCRYPTION_ENV: "automated-tests",
  JOURNAL_KEY_PROVIDER: "development",
  JOURNAL_DEVELOPMENT_WRAPPING_KEY: Buffer.alloc(32, 17).toString("base64"),
  JOURNAL_DATA_KEY_VERSION: "1",
  REDIS_URL: "",
  AI_JOURNAL_PROVIDER: "",
  ANTHROPIC_API_KEY: "",
  AI_JOURNAL_MODEL: "",
  AI_JOURNAL_TIMEOUT_MS: "30000",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  PROFILE_DATABASE: "0",
};
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Test command failed (${code}): ${args[0]}`))
    );
  });
}
let server;
try {
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  if (mode === "e2e") {
    await run(["node_modules/@playwright/test/cli.js", "test"]);
  } else {
    // Never reuse a personal dev server: the API and fixture cleanup must share a database.
    try {
      await fetch(origin + "/login", { signal: AbortSignal.timeout(500) });
      throw new Error("Port 3200 is already in use; stop the previous test server first.");
    } catch (error) {
      if (error.message.startsWith("Port 3200")) throw error;
    }
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "dev", "-p", "3200", "-H", "127.0.0.1"],
      { env, stdio: "inherit" }
    );
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw new Error("Test server exited.");
      try {
        if ((await fetch(origin + "/login", { signal: AbortSignal.timeout(1000) })).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("Test server did not become ready.");
    await run(["node_modules/vitest/vitest.mjs", "run", "--project", "integration"]);
    for (const file of ["test-auth-api.mjs", "test-journal-rest.mjs", "test-mood-trend-api.mjs"])
      await run(["scripts/" + file]);
  }
} finally {
  if (server && server.exitCode === null) server.kill("SIGTERM");
}
