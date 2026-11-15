if (
  process.env.VIBEJOURNAL_TEST_SERVER !== "1" ||
  new URL(process.env.DATABASE_URL ?? "").pathname !== "/vibejournal_test"
) {
  throw new Error("Use npm run test:integration with the isolated vibejournal_test database.");
}
