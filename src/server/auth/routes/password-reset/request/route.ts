import "server-only";

import { credentialsSchema } from "@/features/auth/schemas";
import { createPasswordResetToken } from "@/server/auth/tokens";
import { isSameOriginRequest } from "@/server/auth/request";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/server/rate-limit";
import { jsonError } from "@/lib/http";
import { prisma } from "@/server/db";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Invalid request origin.", 403);
  const body = await request.json().catch(() => null);
  const email = credentialsSchema.shape.email.safeParse(body?.email);
  if (!email.success) return jsonError("Enter a valid email.");
  try {
    await enforceRateLimit("reset", email.data);
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error, true);
    return jsonError("Password reset is temporarily unavailable.", 503);
  }
  const user = await prisma.user.findUnique({ where: { email: email.data } });
  if (!user) return Response.json({ ok: true });
  const token = await createPasswordResetToken(user.id);
  return Response.json({
    ok: true,
    resetToken: process.env.NODE_ENV === "development" ? token : undefined,
  });
}
