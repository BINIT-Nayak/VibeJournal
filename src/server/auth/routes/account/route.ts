import "server-only";

import { clearSessionCookie, requireUser } from "@/server/auth/session";
import { jsonError } from "@/lib/http";
import { prisma } from "@/server/db";

export async function DELETE() {
  try {
    const user = await requireUser();

    await prisma.user.delete({ where: { id: user.id } });
    await clearSessionCookie();

    return Response.json({ ok: true });
  } catch {
    return jsonError("Please log in to delete your account.", 401);
  }
}
