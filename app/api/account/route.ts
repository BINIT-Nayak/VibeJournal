import { clearSessionCookie, requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

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
