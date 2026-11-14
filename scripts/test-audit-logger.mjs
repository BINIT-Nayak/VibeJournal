import assert from "node:assert/strict";
import { load } from "./encryption-loader.mjs";
const repository = load("src/server/audit/repository.ts");
const writes = [],
  cutoffs = [],
  warnings = [];
repository.insertAuditEvent = async (value) => {
  writes.push(value);
};
repository.pruneAuditEvents = async (before) => {
  cutoffs.push(before);
};
const { recordAuditEvent } = load("src/server/audit/service.ts");
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args);
try {
  assert.equal(
    await recordAuditEvent({
      event: "login",
      outcome: "succeeded",
      userId: "opaque-user",
      provider: "credentials",
    }),
    true
  );
  assert.deepEqual(writes[0], {
    event: "login",
    outcome: "succeeded",
    userId: "opaque-user",
    provider: "credentials",
  });
  assert.equal(cutoffs.length, 1);
  assert.ok(Math.abs(+cutoffs[0] - (Date.now() - 30 * 86400000)) < 5000);
  for (const field of [
    "content",
    "email",
    "password",
    "token",
    "ip",
    "userAgent",
    "metadata",
    "request",
    "error",
  ])
    assert.equal(
      await recordAuditEvent({ event: "login", outcome: "failed", [field]: "PRIVATE_SENTINEL" }),
      false
    );
  for (const input of [
    { event: "PRIVATE_SENTINEL", outcome: "succeeded" },
    { event: "login", outcome: "succeeded", reason: "PRIVATE_SENTINEL" },
    { event: "login", outcome: "failed", userId: "email@example.invalid" },
    { event: "account.delete", outcome: "succeeded", userId: "opaque-user" },
    { event: "data.export", outcome: "succeeded", enabled: true },
  ])
    assert.equal(await recordAuditEvent(input), false);
  assert.equal(writes.length, 1);
  repository.insertAuditEvent = async () => {
    throw new Error("PRIVATE_SENTINEL");
  };
  assert.equal(await recordAuditEvent({ event: "logout", outcome: "succeeded" }), false);
  assert.deepEqual(warnings, [["Security audit recording unavailable."]]);
  assert.ok(!JSON.stringify({ writes, warnings }).includes("PRIVATE_SENTINEL"));
  console.log(
    "PASS: strict audit field allowlist, bounded values, deletion anonymity, 30-day pruning, safe throttled diagnostics, fail-open storage failure."
  );
} finally {
  console.warn = originalWarn;
}
