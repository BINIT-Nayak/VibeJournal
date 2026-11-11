import "server-only";

import { credentialsSchema } from "@/features/auth/schemas";
import { createPasswordResetToken } from "@/server/auth/tokens";
import { isSameOriginRequest } from "@/server/auth/request";
import { allowAuthAttempt } from "@/server/auth/rate-limit";
import { jsonError } from "@/lib/http";
import { prisma } from "@/server/db";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Invalid request origin.", 403);
  const body = await request.json().catch(() => null);
  const email = credentialsSchema.shape.email.safeParse(body?.email);
  if (!email.success) return jsonError("Enter a valid email.");
  if (!(await allowAuthAttempt("reset", email.data, 5))) return Response.json({ ok: true });
  const user = await prisma.user.findUnique({ where: { email: email.data } });
  if (!user) return Response.json({ ok: true });
  const token = await createPasswordResetToken(user.id);
  return Response.json({
    ok: true,
    resetToken: process.env.NODE_ENV === "development" ? token : undefined,
  });
}
