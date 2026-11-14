import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { load } from "./encryption-loader.mjs";
nextEnv.loadEnvConfig(process.cwd());
const { prisma } = load("src/server/db.ts");
const { createEntry } = load("src/server/journal/service.ts");
const { sealValue } = load("src/server/encryption/content.ts");
const { deleteOwnAccount, DeletionError } = load("src/server/account-deletion/service.ts");
const { rateLimitKey } = load("src/server/rate-limit.ts");
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const accounts = [];
let stage = "setup";
async function request(account, path, method = "GET", body, requestOrigin = origin) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Origin: requestOrigin,
      "Content-Type": "application/json",
      ...(account?.cookie ? { Cookie: account.cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (account) {
    const jar = new Map(
      (account.cookie ?? "")
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
  return response;
}
try {
  assert.equal(
    (
      await request(null, "/api/account", "DELETE", {
        confirmation: "DELETE",
        password: "irrelevant",
      })
    ).status,
    401
  );
  for (let index = 0; index < 2; index++) {
    const account = {
      email: "deletion-" + randomUUID() + "@example.invalid",
      password: randomUUID(),
    };
    accounts.push(account);
    const response = await request(account, "/api/auth/signup", "POST", account);
    assert.equal(response.status, 200);
    account.id = (await response.json()).user.id;
  }
  const [owner, other] = accounts;
  const secondSession = { ...owner, cookie: "" };
  assert.equal(
    (
      await request(secondSession, "/api/auth/login", "POST", {
        email: owner.email,
        password: owner.password,
      })
    ).status,
    200
  );
  const entry = await createEntry(
    owner,
    { content: "Delete private writing", moodScore: 6, tags: ["delete-tag"] },
    true
  );
  const kept = await createEntry(
    other,
    { content: "Keep private writing", moodScore: 7, tags: ["keep-tag"] },
    true
  );
  await prisma.journalAnalysis.create({
    data: {
      userId: owner.id,
      journalEntryId: entry.id,
      sourceUpdatedAt: new Date(entry.updatedAt),
      primaryEmotion: "calm",
      emotions: ["calm"],
      sentimentScore: 0,
      themes: [],
      estimatedEnergy: 5,
      reflectionPrompt: "",
      confidence: 0.5,
      privatePayload: await sealValue(
        owner.id,
        "analysis",
        entry.id,
        { themes: ["theme"], reflectionPrompt: "prompt" },
        entry.updatedAt
      ),
    },
  });
  await prisma.playlistRun.create({
    data: { userId: owner.id, mood: "calm", intent: {}, provider: "test" },
  });
  await prisma.passwordResetToken.create({
    data: { userId: owner.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) },
  });
  await prisma.moodEntry.create({
    data: { userId: owner.id, mood: "calm", energy: 5, valence: 5, tags: [], photoNames: [] },
  });
  const receiptKey = randomUUID();
  await prisma.journalMutationReceipt.create({
    data: {
      userId: owner.id,
      key: receiptKey,
      entryId: entry.id,
      kind: "create",
      payloadHash: await sealValue(owner.id, "receipt", receiptKey, "fingerprint"),
      result: { entryId: entry.id, updatedAt: entry.updatedAt, deleted: false },
    },
  });
  await prisma.accountDeletionChallenge.create({
    data: { userId: owner.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) },
  });
  stage = "confirmation and reauthentication";
  assert.equal((await request(owner, "/api/account", "DELETE", {})).status, 400);
  assert.equal(
    (await request(owner, "/api/account", "DELETE", { confirmation: "DELETE" })).status,
    401
  );
  assert.equal(
    (
      await request(owner, "/api/account", "DELETE", {
        confirmation: "DELETE",
        password: other.password,
      })
    ).status,
    401
  );
  assert.equal(
    (
      await request(owner, "/api/account", "DELETE", {
        confirmation: "DELETE",
        password: owner.password,
        userId: other.id,
      })
    ).status,
    400
  );
  assert.equal(
    (
      await request(
        owner,
        "/api/account",
        "DELETE",
        { confirmation: "DELETE", password: owner.password },
        "https://attacker.invalid"
      )
    ).status,
    403
  );
  assert.equal(await prisma.user.count({ where: { id: owner.id } }), 1);
  assert.equal(await prisma.journalEntry.count({ where: { userId: owner.id } }), 1);
  stage = "delete and revoke";
  const oldCookie = owner.cookie;
  assert.equal(
    (
      await request(owner, "/api/account", "DELETE", {
        confirmation: "DELETE",
        password: owner.password,
      })
    ).status,
    200
  );
  assert.equal(await prisma.user.count({ where: { id: owner.id } }), 0);
  for (const model of [
    "journalEntry",
    "tag",
    "journalTag",
    "journalAnalysis",
    "userSettings",
    "playlistRun",
    "session",
    "passwordResetToken",
    "journalMutationReceipt",
    "userContentKey",
    "moodEntry",
    "accountDeletionChallenge",
  ])
    assert.equal(
      await prisma[model].count({ where: { userId: owner.id } }),
      0,
      model + " fully removed"
    );
  assert.equal(
    await prisma.authRateLimit.count({ where: { key: rateLimitKey("account-delete", owner.id) } }),
    0
  );
  assert.equal((await request({ cookie: oldCookie }, "/api/account/export")).status, 401);
  assert.equal((await request(secondSession, "/api/account/export")).status, 401);
  assert.equal(
    (
      await request({ cookie: oldCookie }, "/api/account", "DELETE", {
        confirmation: "DELETE",
        password: owner.password,
      })
    ).status,
    401
  );
  assert.ok(await prisma.journalEntry.findUnique({ where: { id: kept.id } }));
  assert.equal((await request(other, "/api/account/export")).status, 200);
  stage = "Google proof ownership and expiry";
  const google = await prisma.user.create({
    data: {
      email: "google-delete-" + randomUUID() + "@example.invalid",
      authProvider: "google",
      googleSubject: randomUUID(),
      settings: { create: {} },
    },
  });
  accounts.push(google);
  await assert.rejects(deleteOwnAccount(google.id, { confirmation: "DELETE" }), DeletionError);
  const proof = randomUUID();
  await prisma.accountDeletionChallenge.create({
    data: { tokenHash: proof, userId: google.id, expiresAt: new Date(Date.now() + 60000) },
  });
  await assert.rejects(
    deleteOwnAccount(google.id, { confirmation: "DELETE" }, proof),
    DeletionError
  );
  await prisma.accountDeletionChallenge.update({
    where: { tokenHash: proof },
    data: { verifiedAt: new Date(), expiresAt: new Date(0) },
  });
  await assert.rejects(
    deleteOwnAccount(google.id, { confirmation: "DELETE" }, proof),
    DeletionError
  );
  const otherProof = randomUUID();
  await prisma.accountDeletionChallenge.create({
    data: {
      tokenHash: otherProof,
      userId: other.id,
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  await assert.rejects(
    deleteOwnAccount(google.id, { confirmation: "DELETE" }, otherProof),
    DeletionError
  );
  await prisma.accountDeletionChallenge.update({
    where: { tokenHash: proof },
    data: { expiresAt: new Date(Date.now() + 60000) },
  });
  await deleteOwnAccount(google.id, { confirmation: "DELETE" }, proof);
  assert.equal(await prisma.user.count({ where: { id: google.id } }), 0);
  assert.ok(await prisma.accountDeletionChallenge.findUnique({ where: { tokenHash: otherProof } }));
  stage = "rate limit";
  for (let index = 0; index < 5; index++)
    assert.equal(
      (
        await request(other, "/api/account", "DELETE", {
          confirmation: "DELETE",
          password: "wrong-password",
        })
      ).status,
      401
    );
  const limited = await request(other, "/api/account", "DELETE", {
    confirmation: "DELETE",
    password: other.password,
  });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
  assert.ok(await prisma.user.findUnique({ where: { id: other.id } }));
  console.log(
    "PASS: confirmation, password verification, CSRF, cross-account isolation, atomic cascades across all owned tables, session revocation, Google proof expiry/ownership/single use, and rate limits."
  );
} catch {
  console.error("Account deletion test failed at", stage, "(private details suppressed).");
  process.exitCode = 1;
} finally {
  await prisma.user.deleteMany({
    where: { email: { in: accounts.map((account) => account.email) } },
  });
  const hashes = accounts
    .filter((account) => account.id)
    .map((account) => rateLimitKey("account-delete", account.id));
  await prisma.authRateLimit.deleteMany({ where: { key: { in: hashes } } });
  await prisma.$disconnect();
}
