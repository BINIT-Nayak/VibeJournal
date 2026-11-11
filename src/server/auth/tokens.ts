import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db";

export const sessionMaxAge = 60 * 60 * 24 * 30;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + 30 * 60_000) },
  });
  return token;
}
