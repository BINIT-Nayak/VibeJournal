import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const db = new PrismaClient();
const origin = new URL(process.env.TEST_APP_URL || "http://localhost:3000").origin;
const emails = [];
const makeAccount = () => {
  const account = {
    email: `auth-test-${randomUUID()}@example.invalid`,
    password: randomUUID(),
    cookie: "",
  };
  emails.push(account.email);
  return account;
};
async function call(
  account,
  path,
  { method = "GET", body, expected = 200, originHeader = origin, form = false } = {}
) {
  const headers = {
    "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json",
  };
  if (originHeader) headers.Origin = originHeader;
  if (account?.cookie) headers.Cookie = account.cookie;
  const res = await fetch(origin + path, {
    method,
    headers,
    redirect: "manual",
    ...(body ? { body: form ? new URLSearchParams(body).toString() : JSON.stringify(body) } : {}),
  });
  assert.equal(res.status, expected, `${method} ${path}`);
  if (account) {
    const jar = new Map(
      account.cookie
        .split("; ")
        .filter(Boolean)
        .map((pair) => [pair.split("=")[0], pair])
    );
    for (const cookie of res.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      jar.set(pair.split("=")[0], pair);
    }
    account.cookie = [...jar.values()].join("; ");
  }
  const text = await res.text();
  return {
    res,
    data: res.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text,
  };
}
const credentials = (a) => ({ email: a.email, password: a.password });
const login = (a) => call(a, "/api/auth/login", { method: "POST", body: credentials(a) });
try {
  const home = await call(null, "/", { expected: 307 });
  assert.ok(home.res.headers.get("location").endsWith("/login"));
  await call(null, "/login");
  assert.equal((await call(null, "/api/auth/me")).data.user, null);
  const providers = (await call(null, "/api/auth/providers")).data;
  assert.equal(providers.credentials.type, "credentials");
  const a = makeAccount(),
    b = makeAccount();
  for (const invalidOrigin of [null, "https://untrusted.example"]) {
    await call(a, "/api/auth/signup", {
      method: "POST",
      body: credentials(a),
      originHeader: invalidOrigin,
      expected: 403,
    });
  }
  await call(a, "/api/auth/signup", {
    method: "POST",
    body: { email: "invalid", password: "short" },
    expected: 400,
  });
  const registered = await call(a, "/api/auth/signup", {
    method: "POST",
    body: {
      ...credentials(a),
      email: ` ${a.email.toUpperCase()} `,
      id: "attacker-id",
      userId: "attacker-id",
    },
  });
  a.id = registered.data.user.id;
  assert.notEqual(a.id, "attacker-id");
  assert.equal(registered.data.user.email, a.email);
  assert.ok(
    registered.res.headers
      .getSetCookie()
      .some(
        (c) => c.includes("authjs.session-token=") && /httponly/i.test(c) && /samesite=lax/i.test(c)
      )
  );
  const stored = await db.user.findUniqueOrThrow({ where: { id: a.id } });
  assert.ok(stored.passwordHash.startsWith("scrypt$131072$8$1$"));
  assert.ok(!JSON.stringify(registered.data).includes(stored.passwordHash));
  await call(a, "/api/auth/signup", { method: "POST", body: credentials(a), expected: 409 });
  b.id = (await call(b, "/api/auth/signup", { method: "POST", body: credentials(b) })).data.user.id;
  assert.equal((await call(a, "/api/auth/me")).data.user.id, a.id);
  const publicSession = (await call(a, "/api/auth/session")).data;
  assert.equal(publicSession.user.id, a.id);
  assert.equal(publicSession.sid, undefined);
  assert.equal(publicSession.credentialVersion, undefined);
  const csrf = (await call(a, "/api/auth/csrf")).data.csrfToken;
  const forgedUpdate = await call(a, "/api/auth/session", {
    method: "POST",
    body: { csrfToken: csrf, data: { user: { id: b.id }, sid: "forged", sub: b.id } },
  });
  assert.equal(forgedUpdate.data.user.id, a.id);
  const created = await call(a, "/api/entries", {
    method: "POST",
    expected: 201,
    body: { userId: b.id, mood: "calm", energy: 5, valence: 5, note: "Test ownership", tags: [] },
  });
  const entryId = created.data.entry.id;
  assert.equal((await db.journalEntry.findUniqueOrThrow({ where: { id: entryId } })).userId, a.id);
  for (const method of ["GET", "PATCH", "DELETE"])
    await call(b, `/api/entries/${entryId}`, {
      method,
      body: method === "PATCH" ? { userId: a.id, note: "forged" } : undefined,
      expected: 404,
    });
  const bad = { cookie: "authjs.session-token=forged; vibejournal_session=forged" };
  assert.equal((await call(bad, "/api/auth/me")).data.user, null);
  await call(bad, "/api/entries", { expected: 401 });
  const noCsrf = { cookie: "" };
  await call(noCsrf, "/api/auth/callback/credentials", {
    method: "POST",
    form: true,
    body: credentials(a),
    expected: 302,
  });
  assert.equal((await call(noCsrf, "/api/auth/me")).data.user, null);
  const wrong = await call(null, "/api/auth/login", {
    method: "POST",
    body: { email: a.email, password: "wrong-password" },
    expected: 401,
  });
  const unknown = makeAccount();
  const nonexistent = await call(null, "/api/auth/login", {
    method: "POST",
    body: credentials(unknown),
    expected: 401,
  });
  assert.deepEqual(wrong.data, nonexistent.data);
  const replay = { cookie: a.cookie };
  await call(a, "/api/auth/logout", { method: "POST" });
  await call(replay, "/api/entries", { expected: 401 });
  await login(a);
  const second = { ...a, cookie: "" };
  await login(second);
  const newPassword = randomUUID();
  await call(a, "/api/settings", {
    method: "PATCH",
    body: { currentPassword: a.password, newPassword },
  });
  for (const session of [a, second]) await call(session, "/api/entries", { expected: 401 });
  a.password = newPassword;
  await login(a);
  const reset = (
    await call(a, "/api/auth/password-reset/request", { method: "POST", body: { email: a.email } })
  ).data.resetToken;
  assert.ok(reset, "Development reset token expected");
  const finalPassword = randomUUID();
  await call(null, "/api/auth/password-reset/confirm", {
    method: "POST",
    body: { token: reset, password: finalPassword },
  });
  await call(a, "/api/entries", { expected: 401 });
  await call(null, "/api/auth/password-reset/confirm", {
    method: "POST",
    body: { token: reset, password: finalPassword },
    expected: 400,
  });
  a.password = finalPassword;
  await login(a);
  const revoked = { cookie: a.cookie };
  await call(a, "/api/account", { method: "DELETE", body: { userId: b.id }, expected: 400 });
  await call(a, "/api/account", {
    method: "DELETE",
    body: { confirmation: "DELETE", password: a.password },
  });
  assert.equal(await db.user.count({ where: { id: b.id } }), 1);
  await call(revoked, "/api/entries", { expected: 401 });
  // Prove pre-Auth.js password hashes still work and are upgraded on login.
  const legacy = makeAccount();
  const salt = randomBytes(16).toString("hex");
  const hash = `${salt}:${scryptSync(legacy.password, salt, 64).toString("hex")}`;
  await db.user.create({
    data: { email: legacy.email, passwordHash: hash, settings: { create: {} } },
  });
  await login(legacy);
  assert.ok(
    (await db.user.findUniqueOrThrow({ where: { email: legacy.email } })).passwordHash.startsWith(
      "scrypt$"
    )
  );
  // Expired server sessions must invalidate an otherwise valid Auth.js cookie.
  const legacyId = (await call(legacy, "/api/auth/me")).data.user.id;
  await db.session.updateMany({ where: { userId: legacyId }, data: { expiresAt: new Date(0) } });
  await call(legacy, "/api/entries", { expected: 401 });
  // Built-in Auth.js callback works with its CSRF token, independently of wrappers.
  const direct = { ...b, cookie: "" };
  const directCsrf = (await call(direct, "/api/auth/csrf")).data.csrfToken;
  await call(direct, "/api/auth/callback/credentials", {
    method: "POST",
    form: true,
    body: { ...credentials(b), csrfToken: directCsrf, callbackUrl: origin },
    expected: 302,
  });
  assert.equal((await call(direct, "/api/auth/me")).data.user.id, b.id);
  const throttled = makeAccount();
  const key = createHmac("sha256", process.env.AUTH_SECRET)
    .update(`login:${throttled.email}`)
    .digest("hex");
  await db.authRateLimit.create({
    data: { key, attempts: 10, resetAt: new Date(Date.now() + 60_000) },
  });
  await call(null, "/api/auth/login", {
    method: "POST",
    body: credentials(throttled),
    expected: 429,
  });
  console.log(
    "PASS: Auth.js credentials, CSRF, protected pages/APIs, ownership, hashing upgrades, throttling, and revocation"
  );
} finally {
  await db.user.deleteMany({ where: { email: { in: emails } } });
  const keys = emails.flatMap((email) =>
    ["login", "register", "reset"].map((scope) =>
      createHmac("sha256", process.env.AUTH_SECRET).update(`${scope}:${email}`).digest("hex")
    )
  );
  await db.authRateLimit.deleteMany({ where: { key: { in: keys } } });
  await db.$disconnect();
  console.log("Temporary auth test accounts and throttle records removed.");
}
