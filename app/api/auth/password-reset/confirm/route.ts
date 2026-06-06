import { hashPassword, hashToken } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");

  if (!token) {
    return jsonError("Reset token is required.");
  }

  if (password.length < 8) {
    return jsonError("Password must be at least 8 characters.");
  }

  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) }
  });

  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
    return jsonError("Reset token is invalid or expired.", 400);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await hashPassword(password) }
    }),
    prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() }
    }),
    prisma.session.deleteMany({ where: { userId: reset.userId } })
  ]);

  return Response.json({ ok: true });
}
