import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { verifyPassword } from "../auth/password";
import { enforceRateLimit, rateLimitKey, rateLimitPolicies } from "../rate-limit";
import { clearKeyCache } from "../encryption/keys";
import { invalidateAnalytics } from "../analytics/cache";
import { redisCommand } from "../redis/client";
import { createHash } from "node:crypto";

export class DeletionError extends Error {
  constructor(
    readonly code: "REAUTH_REQUIRED" | "INVALID_CONFIRMATION",
    message: string
  ) {
    super(message);
  }
}
const deletionInput = z
  .object({
    confirmation: z.literal("DELETE"),
    password: z.string().min(1).max(128).optional(),
  })
  .strict();

export async function deleteOwnAccount(userId: string, input: unknown, challengeHash?: string) {
  if (!userId) throw new Error("UNAUTHORIZED");
  const parsed = deletionInput.safeParse(input);
  if (!parsed.success)
    throw new DeletionError(
      "INVALID_CONFIRMATION",
      "Type DELETE and confirm your identity to delete your account."
    );
  await enforceRateLimit("account-delete", userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("UNAUTHORIZED");
  if (
    user.passwordHash &&
    (!parsed.data.password || !(await verifyPassword(parsed.data.password, user.passwordHash)))
  )
    throw new DeletionError("REAUTH_REQUIRED", "Your current password is incorrect.");
  const rateKeys = Object.entries(rateLimitPolicies).flatMap(([scope, policy]) =>
    [userId, user.email].map((identifier) => ({ hash: rateLimitKey(scope, identifier), ...policy }))
  );
  await prisma.$transaction(async (tx) => {
    if (!user.passwordHash) {
      if (!user.googleSubject || !challengeHash)
        throw new DeletionError(
          "REAUTH_REQUIRED",
          "Re-authenticate with Google before deleting your account."
        );
      // Atomic, expiring, single-use proof tied to this account.
      const proof = await tx.accountDeletionChallenge.deleteMany({
        where: {
          tokenHash: challengeHash,
          userId,
          expiresAt: { gt: new Date() },
          verifiedAt: { not: null },
        },
      });
      if (proof.count !== 1)
        throw new DeletionError(
          "REAUTH_REQUIRED",
          "Google verification expired. Please verify again."
        );
    }
    // A concurrent password/account change invalidates the earlier verification.
    const deleted = await tx.user.deleteMany({
      where: {
        id: userId,
        passwordHash: user.passwordHash,
        googleSubject: user.googleSubject,
        email: user.email,
      },
    });
    if (deleted.count !== 1)
      throw new DeletionError("REAUTH_REQUIRED", "Your account changed. Please sign in again.");
    await tx.authRateLimit.deleteMany({ where: { key: { in: rateKeys.map((key) => key.hash) } } });
    // FK cascades atomically delete journals, analyses, tag links/tags, settings,
    // playlist runs, legacy moods, sessions, reset tokens, receipts, keys and challenges.
  });
  // Wrapped keys no longer exist: other processes cannot resolve cached plaintext keys.
  clearKeyCache();
  await invalidateAnalytics(userId);
  const ownerHash = createHash("sha256").update(userId).digest("hex");
  // Optional Redis cleanup; database correctness never depends on Redis availability.
  for (const version of ["v1", "v2"]) {
    let cursor = "0";
    do {
      const result = await redisCommand([
        "SCAN",
        cursor,
        "MATCH",
        `vibejournal:analytics:${version}:{${ownerHash}}*`,
        "COUNT",
        "100",
      ]);
      if (!Array.isArray(result) || typeof result[0] !== "string" || !Array.isArray(result[1]))
        break;
      cursor = result[0];
      const keys = result[1].filter((key): key is string => typeof key === "string");
      if (keys.length) await redisCommand(["DEL", ...keys]);
    } while (cursor !== "0");
  }
  for (const key of rateKeys)
    await redisCommand([
      "DEL",
      `vibejournal:rate-limit:v1:${key.limit}:${key.seconds}:${key.hash}`,
    ]);
}
