import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const origin = process.env.TEST_APP_URL || "http://localhost:3000";
const accounts = [];

async function request(account, path, method = "GET", body, expected = 200) {
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
  await request(null, "/api/entries", "GET", undefined, 401);
  for (let index = 0; index < 2; index++) {
    const account = {
      email: `journal-test-${randomUUID()}@example.invalid`,
      password: randomUUID(),
    };
    accounts.push(account);
    const result = await request(account, "/api/auth/signup", "POST", account);
    account.id = result.user.id;
  }
  const [owner, other] = accounts;
  for (const [path, method] of [
    ["/api/journal", "GET"],
    ["/api/journal", "POST"],
    ["/api/journal/missing", "GET"],
    ["/api/journal/missing", "PATCH"],
    ["/api/journal/missing", "DELETE"],
  ]) {
    const result = await request(
      null,
      path,
      method,
      method === "POST" || method === "PATCH" ? {} : undefined,
      401
    );
    assert.equal(result.error.code, "UNAUTHORIZED");
  }
  assert.deepEqual((await request(owner, "/api/journal")).pageInfo, {
    nextCursor: null,
    hasMore: false,
  });
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const { entry } = await request(
      owner,
      "/api/journal",
      "POST",
      { title: `Title ${i}`, content: `Entry ${i}`, moodScore: 5, userId: other.id },
      201
    );
    ids.push(entry.id);
    assert.equal(entry.content, `Entry ${i}`);
    assert.equal(entry.energyScore, null);
  }
  // Tied timestamps exercise the stable ID tie-breaker.
  await prisma.journalEntry.updateMany({
    where: { userId: owner.id },
    data: { createdAt: new Date("2026-01-01T00:00:00.000Z") },
  });
  const expected = [...ids].sort().reverse();
  const first = await request(owner, "/api/journal?limit=2");
  assert.deepEqual(
    first.entries.map((e) => e.id),
    expected.slice(0, 2)
  );
  assert.equal(first.pageInfo.hasMore, true);
  const cursor = first.pageInfo.nextCursor;
  await request(owner, `/api/journal/${expected[1]}`, "DELETE", undefined, 204);
  const second = await request(owner, `/api/journal?limit=2&cursor=${cursor}`);
  assert.deepEqual(
    second.entries.map((e) => e.id),
    expected.slice(2, 4)
  );
  const last = await request(owner, `/api/journal?limit=2&cursor=${second.pageInfo.nextCursor}`);
  assert.deepEqual(
    last.entries.map((e) => e.id),
    expected.slice(4)
  );
  assert.deepEqual(last.pageInfo, { nextCursor: null, hasMore: false });
  for (const query of ["limit=0", "limit=101", "limit=-1", "limit=2.5", "limit=abc", "limit="]) {
    assert.equal(
      (await request(owner, `/api/journal?${query}`, "GET", undefined, 400)).error.code,
      "VALIDATION_ERROR"
    );
  }
  assert.equal(
    (await request(owner, "/api/journal?cursor=garbage", "GET", undefined, 400)).error.code,
    "INVALID_CURSOR"
  );
  assert.equal(
    (await request(other, `/api/journal?cursor=${cursor}`, "GET", undefined, 400)).error.code,
    "INVALID_CURSOR"
  );
  const path = `/api/journal/${expected[0]}`;
  for (const method of ["GET", "PATCH", "DELETE"]) {
    assert.equal(
      (
        await request(
          other,
          path,
          method,
          method === "PATCH" ? { content: "Forbidden" } : undefined,
          404
        )
      ).error.code,
      "NOT_FOUND"
    );
  }
  const invalid = await request(owner, path, "PATCH", { content: " ", moodScore: 20 }, 400);
  assert.equal(invalid.error.code, "VALIDATION_ERROR");
  assert.ok(invalid.error.issues.some((i) => i.path === "content"));
  const updated = await request(owner, path, "PATCH", {
    content: "Edited",
    exercised: false,
    tags: [" Rest "],
  });
  assert.equal(updated.entry.content, "Edited");
  assert.equal(updated.entry.exercised, false);
  assert.deepEqual(updated.entry.tags, ["rest"]);
  assert.equal((await request(owner, path)).entry.content, "Edited");
  const malformed = await fetch(`${origin}/api/journal`, {
    method: "POST",
    headers: { Cookie: owner.cookie, Origin: origin, "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, "INVALID_JSON");
  const forbidden = await fetch(`${origin}/api/journal`, {
    method: "POST",
    headers: {
      Cookie: owner.cookie,
      Origin: "https://example.invalid",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).error.code, "FORBIDDEN");
  console.log(
    "PASS: journal REST CRUD, authentication, ownership, typed errors, tied-date pagination, deleted cursor entry, cursor validation, limits and nullable DTO fields."
  );
} finally {
  // Remove only test accounts, including when an assertion or login request fails.
  for (const account of accounts) {
    await prisma.user.deleteMany({ where: { email: account.email } });
  }
  await prisma.$disconnect();
  console.log("Temporary test accounts and their data removed.");
}
