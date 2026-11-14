import "server-only";
import { sealValue, openValue } from "../encryption/content";
import { createHash, randomUUID } from "node:crypto";
import type { AnalyticsResponse } from "@/features/analytics/types";
import { redisCommand } from "../redis/client";

export const ANALYTICS_TTL_SECONDS = 300;
const GENERATION_TTL_SECONDS = 86400;

function userPrefix(userId: string) {
  // Hash tags keep each user's Lua keys in the same Redis Cluster slot.
  const owner = createHash("sha256").update(userId).digest("hex");
  return `vibejournal:analytics:v2:{${owner}}`;
}

export async function invalidateAnalytics(userId: string) {
  await redisCommand([
    "SET",
    `${userPrefix(userId)}:generation`,
    randomUUID(),
    "EX",
    String(GENERATION_TTL_SECONDS),
  ]);
}

export async function cachedAnalytics(
  userId: string,
  startDate: string,
  endDate: string,
  compute: () => Promise<AnalyticsResponse>
): Promise<AnalyticsResponse> {
  const prefix = userPrefix(userId);
  const generationKey = `${prefix}:generation`;
  const generation = await redisCommand([
    "EVAL",
    `local version = redis.call('GET', KEYS[1])
     if not version then
       version = ARGV[1]
       redis.call('SET', KEYS[1], version, 'EX', ARGV[2])
     end
     return version`,
    "1",
    generationKey,
    randomUUID(),
    String(GENERATION_TTL_SECONDS),
  ]);
  if (typeof generation !== "string") return compute();
  const key = `${prefix}:${generation}:UTC:${startDate}:${endDate}`;
  const cached = await redisCommand(["GET", key]);
  if (typeof cached === "string") {
    try {
      const value = (await openValue(userId, "cache", key, cached)) as AnalyticsResponse;
      if (
        value.period?.startDate === startDate &&
        value.period.endDate === endDate &&
        value.statistics &&
        value.insights &&
        value.correlations &&
        value.sleepComparison &&
        value.exerciseComparison
      )
        return value;
    } catch {
      // A malformed/old cache entry is a miss, never an analytics failure.
    }
  }
  const result = await compute();
  // Compare and set atomically: a journal write during computation makes this
  // generation obsolete, so the old result cannot repopulate the active cache.
  try {
    await redisCommand([
      "EVAL",
      `if redis.call('GET', KEYS[1]) == ARGV[1] then
       return redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
     end
     return 0`,
      "2",
      generationKey,
      key,
      generation,
      await sealValue(userId, "cache", key, result),
      String(ANALYTICS_TTL_SECONDS),
    ]);
  } catch {
    /* Never substitute plaintext when cache encryption is unavailable. */
  }
  return result;
}
