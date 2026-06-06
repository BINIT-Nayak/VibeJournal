import { createSession, hashPassword, normalizeEmail, setSessionCookie } from "@/lib/auth";
import { jsonError, serializeSettings } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim() || null;

  if (!email.includes("@")) {
    return jsonError("Enter a valid email.");
  }

  if (password.length < 8) {
    return jsonError("Password must be at least 8 characters.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return jsonError("An account already exists for this email.", 409);
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      settings: { create: {} }
    },
    include: { settings: true }
  });
  const session = await createSession(user.id);
  await setSessionCookie(session.token, session.expiresAt);

  return Response.json({
    user: { id: user.id, email: user.email, name: user.name },
    entries: [],
    settings: serializeSettings(user.settings!)
  });
}
