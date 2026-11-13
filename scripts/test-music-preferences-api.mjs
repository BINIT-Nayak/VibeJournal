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
  await request(null, "/api/music/preferences", "GET", undefined, 401);
  for (let i = 0; i < 2; i++) {
    const account = {
      email: `music-preference-test-${randomUUID()}@example.invalid`,
      password: randomUUID(),
    };
    accounts.push(account);
    account.id = (await request(account, "/api/auth/signup", "POST", account)).user.id;
  }
  const [owner, other] = accounts;
  const defaults = {
    favoriteGenres: [],
    dislikedGenres: [],
    preferredLanguages: [],
    allowExplicit: false,
  };
  assert.deepEqual((await request(owner, "/api/music/preferences")).preferences, defaults);
  const prefs = {
    favoriteGenres: ["jazz", "classical"],
    dislikedGenres: ["rock"],
    preferredLanguages: ["hindi", "english"],
    allowExplicit: true,
  };
  const saved = await request(owner, "/api/settings", "PATCH", {
    musicPreferences: prefs,
    userId: other.id,
  });
  assert.deepEqual(saved.settings.musicPreferences, prefs);
  assert.deepEqual((await request(owner, "/api/music/preferences")).preferences, prefs);
  assert.deepEqual((await request(other, "/api/music/preferences")).preferences, defaults);
  for (const invalid of [
    { ...prefs, dislikedGenres: ["jazz"] },
    { ...prefs, allowExplicit: "false" },
    { ...prefs, favoriteGenres: ["jazz", "jazz"] },
    { ...prefs, preferredLanguages: ["invalid"] },
    { ...prefs, unknown: true },
    null,
    {},
  ])
    await request(owner, "/api/settings", "PATCH", { musicPreferences: invalid }, 400);
  assert.deepEqual((await request(owner, "/api/music/preferences")).preferences, prefs);
  await request(owner, "/api/settings", "PATCH", { darkMode: true });
  assert.deepEqual((await request(owner, "/api/music/preferences")).preferences, prefs);
  await request(owner, "/api/settings", "PATCH", { musicPreferences: defaults });
  assert.deepEqual((await request(owner, "/api/music/preferences")).preferences, defaults);
  console.log(
    "PASS: music preference defaults, persistence, owner isolation, invalid/conflicting inputs, unrelated updates and reset."
  );
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
