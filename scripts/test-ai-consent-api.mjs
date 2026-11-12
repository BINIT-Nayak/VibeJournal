import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const accounts = [];

async function request(account, path, method = "GET", body, expected = 200) {
  if (method === "PATCH" && account?.cookie && body && !("expectedUpdatedAt" in body)) {
    const current = await fetch(`${origin}${path}`, { headers: { Cookie: account.cookie } });
    if (current.ok) body = { ...body, expectedUpdatedAt: (await current.json()).entry.updatedAt };
  }
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(origin).origin,
      ...(account?.cookie ? { Cookie: account.cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, expected, `${method} ${path}`);
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
  return response.status === 204 ? null : response.json();
}

try {
  await request(null, "/api/settings", "PATCH", { aiConsent: true }, 401);
  for (let i = 0; i < 2; i++) {
    const account = {
      email: `consent-test-${randomUUID()}@example.invalid`,
      password: randomUUID(),
    };
    accounts.push(account);
    account.id = (await request(account, "/api/auth/signup", "POST", account)).user.id;
  }
  const [owner, other] = accounts;
  const settings = () => prisma.userSettings.findUnique({ where: { userId: owner.id } });
  assert.equal((await settings())?.aiConsent ?? false, false);
  for (const value of ["true", 1, null, {}, []])
    await request(owner, "/api/settings", "PATCH", { aiConsent: value }, 400);
  assert.equal((await settings())?.aiConsent ?? false, false);
  await request(owner, "/api/settings", "PATCH", { darkMode: true });
  assert.equal((await settings()).aiConsent, false);
  const enabled = await request(owner, "/api/settings", "PATCH", {
    aiConsent: true,
    userId: other.id,
  });
  assert.equal(enabled.settings.aiConsent, true);
  assert.equal(
    (await prisma.userSettings.findUnique({ where: { userId: other.id } }))?.aiConsent ?? false,
    false
  );
  assert.equal((await request(owner, "/api/auth/me")).settings.aiConsent, true);
  await request(owner, "/api/settings", "PATCH", { reminderEnabled: false });
  assert.equal((await settings()).aiConsent, true);
  const disabled = await request(owner, "/api/settings", "PATCH", { aiConsent: false });
  assert.equal(disabled.settings.aiConsent, false);
  assert.equal((await request(owner, "/api/auth/me")).settings.aiConsent, false);
  console.log(
    "PASS: consent defaults off, explicit boolean validation, authenticated owner scope, persistence, unrelated settings and opt-out."
  );
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
