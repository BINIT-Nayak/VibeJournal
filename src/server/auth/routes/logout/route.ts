import "server-only";

import { destroyCurrentSession } from "@/server/auth/session";
import { isSameOriginRequest } from "@/server/auth/request";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Invalid request origin.", 403);
  await destroyCurrentSession();
  return Response.json({ ok: true });
}
