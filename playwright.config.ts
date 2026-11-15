import { defineConfig, devices } from "@playwright/test";
if (process.env.VIBEJOURNAL_TEST_SERVER !== "1")
  throw new Error("Use npm run test:e2e for the isolated environment.");
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -p 3200 -H 127.0.0.1",
    url: "http://127.0.0.1:3200/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
