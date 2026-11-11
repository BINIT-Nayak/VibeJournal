import "server-only";

import { createHmac } from "node:crypto";
import { prisma } from "@/server/db";

export async function allowAuthAttempt(scope: string, identifier: string, limit = 10) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required.");
  const key = createHmac("sha256", secret).update(`${scope}:${identifier}`).digest("hex");
  // Prisma DateTime columns use UTC timestamp-without-time-zone values. Use an
  // explicit UTC database clock so comparisons do not depend on server TimeZone.
  const [result] = await prisma.$queryRaw<Array<{ attempts: number }>>`
    INSERT INTO "AuthRateLimit" ("key", "attempts", "resetAt")
    VALUES (${key}, 1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "AuthRateLimit"."resetAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 1 ELSE "AuthRateLimit"."attempts" + 1 END,
      "resetAt" = CASE WHEN "AuthRateLimit"."resetAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '15 minutes' ELSE "AuthRateLimit"."resetAt" END
    RETURNING "attempts"
  `;
  return result.attempts <= limit;
}
