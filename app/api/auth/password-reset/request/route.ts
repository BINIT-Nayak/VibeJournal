import { createPasswordResetToken, normalizeEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
