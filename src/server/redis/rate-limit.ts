import "server-only";
import { redisCommand } from "./client";

function blockKey(identityHash: string, limit: number, seconds: number) {
  // Policy changes must not reuse a block from an older limit/window.
  return `vibejournal:rate-limit:v1:${limit}:${seconds}:${identityHash}`;
}

export async function readRateLimitState(identityHash: string, limit: number, seconds: number) {
  const result = await redisCommand([
    "EVAL",
    `local now = redis.call('TIME')
     return {redis.call('PTTL', KEYS[1]), now[1] * 1000 + math.floor(now[2] / 1000)}`,
    "1",
    blockKey(identityHash, limit, seconds),
  ]);
  if (
    !Array.isArray(result) ||
    result.length !== 2 ||
    !result.every((value) => typeof value === "number" && Number.isFinite(value))
  )
    return null;
  return {
    retryAfter: result[0] > 0 ? Math.ceil(result[0] / 1000) : null,
    clockMs: result[1] as number,
  };
}

export async function readRateLimitBlock(identityHash: string, limit: number, seconds: number) {
  return (await readRateLimitState(identityHash, limit, seconds))?.retryAfter ?? null;
}

export async function cacheRateLimitBlock(
  identityHash: string,
  limit: number,
  seconds: number,
  ttlMs: number,
  redisClockMs: number
) {
  const ttl = Math.floor(ttlMs);
  if (ttl <= 0) return;
  // Anchor expiry to Redis time sampled BEFORE the database check. Even delayed
  // commands cannot extend the durable window; NX also prevents renewals.
  await redisCommand([
    "SET",
    blockKey(identityHash, limit, seconds),
    "1",
    "PXAT",
    String(redisClockMs + ttl),
    "NX",
  ]);
}
