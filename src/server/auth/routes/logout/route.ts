import "server-only";

import { destroyCurrentSession } from "@/server/auth/session";

export async function POST() {
  await destroyCurrentSession();

  return Response.json({ ok: true });
}
