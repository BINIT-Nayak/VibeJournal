import { destroyCurrentSession } from "@/lib/auth";

export async function POST() {
  await destroyCurrentSession();

  return Response.json({ ok: true });
}
