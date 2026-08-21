import { createSession, normalizeEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { jsonError, serializeEntry, serializeSettings } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");

  const user = await prisma.user.findUnique({
    where: { email },
    include: { settings: true },
  });

  if (!user?.passwordHash) {
    return jsonError("Use Google login for this account, or reset your password.", 401);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return jsonError("Email or password is incorrect.", 401);
  }

  const settings =
    user.settings ?? (await prisma.userSettings.create({ data: { userId: user.id } }));
  const entries = await prisma.moodEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const session = await createSession(user.id);
  await setSessionCookie(session.token, session.expiresAt);

  return Response.json({
    user: { id: user.id, email: user.email, name: user.name },
    entries: entries.map(serializeEntry),
    settings: serializeSettings(settings),
  });
}
