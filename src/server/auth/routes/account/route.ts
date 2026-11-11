import "server-only";

import { destroyCurrentSession, requireUser } from "@/server/auth/session";
import { jsonError } from "@/lib/http";
import { prisma } from "@/server/db";

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);

    await prisma.user.delete({ where: { id: user.id } });
    await destroyCurrentSession();

    return Response.json({ ok: true });
  } catch {
    return jsonError("Please log in to delete your account.", 401);
  }
}
