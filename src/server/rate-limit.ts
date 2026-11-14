import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "./db";
import { readRateLimitBlock, readRateLimitState, cacheRateLimitBlock } from "./redis/rate-limit";

// Fixed windows use the database clock and atomic upserts across all processes.
export const rateLimitPolicies = {
  "account-delete": { limit: 5, seconds: 900 },
  login: { limit: 10, seconds: 900 },
  register: { limit: 5, seconds: 900 },
  reset: { limit: 5, seconds: 900 },
  "reset-confirm": { limit: 5, seconds: 900 },
  "ai-user": { limit: 5, seconds: 900 },
  "ai-weekly": { limit: 3, seconds: 3600 },
  music: { limit: 20, seconds: 60 },
} as const;
export type RateLimitScope = keyof typeof rateLimitPolicies;
export class RateLimitError extends Error {
  constructor(readonly retryAfter: number) {
    super(`Too many requests. Try again in ${retryAfter} seconds.`);
  }
}
export function rateLimitKey(scope: string, identifier: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !identifier) throw new Error("Rate limiter is not configured.");
  return createHmac("sha256", secret).update(`${scope}:${identifier}`).digest("hex");
}
export async function consumeRateLimit(scope: RateLimitScope, identifier: string) {
  const { limit, seconds } = rateLimitPolicies[scope];
  const key = rateLimitKey(scope, identifier);
  const redisState = await readRateLimitState(key, limit, seconds);
  if (redisState?.retryAfter != null) return { allowed: false, retryAfter: redisState.retryAfter };
  const started = performance.now();
  const [row] = await prisma.$queryRaw<Array<{ attempts: number; retryAfter: number }>>`
    INSERT INTO "AuthRateLimit" ("key", "attempts", "resetAt")
    VALUES (${key}, 1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + ${seconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "AuthRateLimit"."resetAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        THEN 1 ELSE LEAST("AuthRateLimit"."attempts", ${limit}) + 1 END,
      "resetAt" = CASE WHEN "AuthRateLimit"."resetAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + ${seconds} * INTERVAL '1 second'
        ELSE "AuthRateLimit"."resetAt" END
    RETURNING "attempts", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("resetAt" - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))))::int AS "retryAfter"
  `;
  if (row.attempts > limit && redisState) {
    // Round down and subtract all DB latency: Redis must never outlive the
    // durable window, including when a response is delayed in transit.
    const ttlMs = (row.retryAfter - 1) * 1000 - (performance.now() - started);
    await cacheRateLimitBlock(key, limit, seconds, ttlMs, redisState.clockMs);
  }
  return { allowed: row.attempts <= limit, retryAfter: row.retryAfter };
}
export async function enforceRateLimit(scope: RateLimitScope, identifier: string) {
  const result = await consumeRateLimit(scope, identifier);
  if (!result.allowed) throw new RateLimitError(result.retryAfter);
}
export async function rateLimitRetryAfter(scope: RateLimitScope, identifier: string) {
  const key = rateLimitKey(scope, identifier);
  const { limit, seconds } = rateLimitPolicies[scope];
  const blockedFor = await readRateLimitBlock(key, limit, seconds);
  if (blockedFor !== null) return blockedFor;
  const [row] = await prisma.$queryRaw<Array<{ retryAfter: number }>>`
    SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("resetAt" - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))))::int AS "retryAfter"
    FROM "AuthRateLimit" WHERE "key" = ${key}
  `;
  return row?.retryAfter ?? rateLimitPolicies[scope].seconds;
}
export function rateLimitResponse(error: RateLimitError, legacy = false) {
  return Response.json(
    {
      error: legacy
        ? error.message
        : { code: "RATE_LIMITED", message: error.message, retryAfter: error.retryAfter },
      ...(legacy ? { code: "RATE_LIMITED", retryAfter: error.retryAfter } : {}),
    },
    {
      status: 429,
      headers: { "Retry-After": String(error.retryAfter), "Cache-Control": "private, no-store" },
    }
  );
}
