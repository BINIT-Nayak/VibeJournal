import "server-only";
import { recordAuditEvent } from "@/server/audit/service";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/server/rate-limit";

import { credentialsSchema } from "@/features/auth/schemas";
import { hashPassword } from "@/server/auth/password";
import { hashToken } from "@/server/auth/tokens";
import { isSameOriginRequest } from "@/server/auth/request";
import { jsonError } from "@/lib/http";
import { prisma } from "@/server/db";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    await recordAuditEvent({
      event: "password.reset",
      outcome: "denied",
      reason: "invalid_origin",
    });
    return jsonError("Invalid request origin.", 403);
  }
  const body = await request.json().catch(() => null);
  const password = credentialsSchema.shape.password.safeParse(body?.password);
  if (!password.success || typeof body?.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) {
    await recordAuditEvent({ event: "password.reset", outcome: "denied", reason: "invalid_input" });
    return jsonError("A valid reset token and an 8–128 character password are required.");
  }
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(body.token) },
  });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
    await recordAuditEvent({
      event: "password.reset",
      outcome: "denied",
      reason: "invalid_credentials",
    });
    return jsonError("Reset token is invalid or expired.");
  }
  try {
    await enforceRateLimit("reset-confirm", reset.userId);
  } catch (error) {
    await recordAuditEvent({
      event: "password.reset",
      outcome: error instanceof RateLimitError ? "denied" : "failed",
      userId: reset.userId,
      reason: error instanceof RateLimitError ? "rate_limited" : "unavailable",
    });
    if (error instanceof RateLimitError) return rateLimitResponse(error, true);
    return jsonError("Password reset is temporarily unavailable.", 503);
  }
  try {
    const passwordHash = await hashPassword(password.data);
    const changed = await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: reset.userId } });
      await tx.passwordResetToken.deleteMany({
        where: { userId: reset.userId, id: { not: reset.id } },
      });
      return true;
    });
    await recordAuditEvent({
      event: "password.reset",
      outcome: changed ? "succeeded" : "denied",
      userId: reset.userId,
      ...(changed ? {} : { reason: "invalid_credentials" as const }),
    });
    return changed ? Response.json({ ok: true }) : jsonError("Reset token is invalid or expired.");
  } catch {
    await recordAuditEvent({
      event: "password.reset",
      outcome: "failed",
      userId: reset.userId,
      reason: "unavailable",
    });
    return jsonError("Password reset is temporarily unavailable.", 503);
  }
}
