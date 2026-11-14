import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { hashToken } from "../auth/tokens";

export const deletionCookie = "vibejournal-delete-reauth";
export async function deletionTokenHash() {
  const token = (await cookies()).get(deletionCookie)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? hashToken(token) : undefined;
}
export async function beginGoogleDeletionReauth(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  await prisma.$transaction([
    prisma.accountDeletionChallenge.deleteMany({ where: { userId } }),
    prisma.accountDeletionChallenge.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    }),
  ]);
  (await cookies()).set(deletionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
// Invoked only from Auth.js's verified Google profile callback, before account creation/linking.
export async function checkGoogleDeletionIdentity(subject: string) {
  const hash = await deletionTokenHash();
  if (!hash) return;
  const challenge = await prisma.accountDeletionChallenge.findUnique({
    where: { tokenHash: hash },
    include: { user: { select: { googleSubject: true } } },
  });
  if (!challenge || challenge.expiresAt <= new Date()) {
    await clearDeletionCookie();
    return;
  }
  if (challenge.user.googleSubject !== subject)
    throw new Error("Account re-authentication failed.");
}
// Called after Auth.js validates the provider and creates a new server session.
export async function completeGoogleDeletionReauth(userId: string) {
  const hash = await deletionTokenHash();
  if (!hash) return;
  await prisma.accountDeletionChallenge.updateMany({
    where: { tokenHash: hash, userId, expiresAt: { gt: new Date() }, verifiedAt: null },
    data: { verifiedAt: new Date() },
  });
}
export async function clearDeletionCookie() {
  (await cookies()).delete(deletionCookie);
}
