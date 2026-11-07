import "server-only";

import { createPasswordResetToken, normalizeEmail } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function POST(request: Request) {
  const body = await request.json();
  const email = normalizeEmail(String(body.email ?? ""));
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return Response.json({ ok: true });
  }

  const token = await createPasswordResetToken(user.id);

  return Response.json({
    ok: true,
    resetToken: process.env.NODE_ENV === "production" ? undefined : token,
  });
}
