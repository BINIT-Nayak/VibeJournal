import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { load } from "./encryption-loader.mjs";
nextEnv.loadEnvConfig(process.cwd());
const { prisma } = load("src/server/db.ts");
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const account = {
  email: "audit-" + randomUUID() + "@example.invalid",
  password: randomUUID(),
  cookie: "",
};
const sentinel = "PRIVATE_JOURNAL_SENTINEL_" + randomUUID();
let stage = "setup";
async function call(path, method = "GET", body, expected = 200) {
  const response = await fetch(origin + path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json", Cookie: account.cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const jar = new Map(
    account.cookie
      .split("; ")
      .filter(Boolean)
      .map((pair) => [pair.split("=")[0], pair])
  );
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    jar.set(pair.split("=")[0], pair);
  }
  account.cookie = [...jar.values()].join("; ");
  assert.equal(response.status, expected);
  return response.json();
}
async function events(event, outcome) {
  return prisma.securityAuditEvent.findMany({
    where: { userId: account.id, event, ...(outcome ? { outcome } : {}) },
    orderBy: { createdAt: "asc" },
  });
}
try {
  account.id = (
    await call("/api/auth/signup", "POST", { email: account.email, password: account.password })
  ).user.id;
  stage = "login/logout";
  assert.equal((await events("login", "succeeded")).length, 1);
  await call("/api/auth/logout", "POST");
  assert.equal((await events("logout", "succeeded")).length, 1);
  await call("/api/auth/login", "POST", { email: account.email, password: "wrong-password" }, 401);
  assert.equal((await events("login", "denied")).length, 1);
  await call("/api/auth/login", "POST", { email: account.email, password: account.password });
  assert.equal((await events("login", "succeeded")).length, 2);
  stage = "AI preference and export";
  await call("/api/settings", "PATCH", { aiConsent: true, content: sentinel });
  await call("/api/settings", "PATCH", { aiConsent: false });
  assert.deepEqual(
    (await events("ai.preference", "succeeded")).map((event) => event.enabled),
    [true, false]
  );
  await call("/api/journal", "POST", { content: sentinel, moodScore: 6 }, 201);
  await call("/api/account/export?content=" + sentinel, "GET", undefined, 400);
  const exported = await call("/api/account/export");
  assert.ok(exported.journals.some((entry) => entry.content === sentinel));
  assert.ok(exported.securityAuditEvents.some((event) => event.event === "login"));
  assert.equal((await events("data.export", "requested")).length, 2);
  assert.equal((await events("data.export", "succeeded")).length, 1);
  assert.equal((await events("data.export", "denied")).length, 1);
  stage = "password change/reset";
  const newPassword = randomUUID();
  await call("/api/settings", "PATCH", { currentPassword: "wrong-password", newPassword }, 401);
  assert.equal((await events("password.change", "denied")).length, 1);
  await call("/api/settings", "PATCH", { currentPassword: account.password, newPassword });
  account.password = newPassword;
  assert.equal((await events("password.change", "succeeded")).length, 1);
  await call("/api/auth/login", "POST", { email: account.email, password: account.password });
  const reset = await call("/api/auth/password-reset/request", "POST", { email: account.email });
  const finalPassword = randomUUID();
  await call("/api/auth/password-reset/confirm", "POST", {
    token: reset.resetToken,
    password: finalPassword,
  });
  assert.equal((await events("password.reset", "succeeded")).length, 1);
  account.password = finalPassword;
  await call("/api/auth/login", "POST", { email: account.email, password: account.password });
  stage = "privacy and deletion";
  const rows = await prisma.securityAuditEvent.findMany({ where: { userId: account.id } });
  const serialized = JSON.stringify(rows);
  for (const secret of [
    sentinel,
    account.email,
    newPassword,
    finalPassword,
    reset.resetToken,
    account.cookie,
  ])
    assert.ok(!serialized.includes(secret), "no private data in audit rows");
  await call("/api/account", "DELETE", { confirmation: "DELETE", password: "wrong-password" }, 401);
  assert.equal((await events("account.delete", "denied")).length, 1);
  const since = new Date();
  await call("/api/account", "DELETE", { confirmation: "DELETE", password: account.password });
  assert.equal(await prisma.securityAuditEvent.count({ where: { userId: account.id } }), 0);
  const anonymous = await prisma.securityAuditEvent.findMany({
    where: { event: "account.delete", outcome: "succeeded", createdAt: { gte: since } },
  });
  assert.ok(anonymous.length > 0);
  assert.ok(
    anonymous.every(
      (row) =>
        row.userId === null && row.reason === null && row.provider === null && row.enabled === null
    )
  );
  const expiredId = randomUUID();
  await prisma.securityAuditEvent.create({
    data: {
      id: expiredId,
      event: "login",
      outcome: "denied",
      createdAt: new Date(Date.now() - 31 * 86400000),
    },
  });
  await load("src/server/audit/repository.ts").pruneAuditEvents(
    new Date(Date.now() - 30 * 86400000)
  );
  assert.equal(await prisma.securityAuditEvent.count({ where: { id: expiredId } }), 0);
  console.log(
    "PASS: login/logout, password change/reset, AI preference, export request/outcomes, deletion anonymity, retention and absence of journal content/credentials in audit records."
  );
} catch {
  console.error("Audit integration test failed at", stage, "(private details suppressed).");
  process.exitCode = 1;
} finally {
  await prisma.user.deleteMany({ where: { email: account.email } });
  await prisma.$disconnect();
}
