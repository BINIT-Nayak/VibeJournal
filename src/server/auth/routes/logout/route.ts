import "server-only";
import { recordAuditEvent } from "@/server/audit/service";

import { destroyCurrentSession } from "@/server/auth/session";
import { isSameOriginRequest } from "@/server/auth/request";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    await recordAuditEvent({ event: "logout", outcome: "denied", reason: "invalid_origin" });
    return jsonError("Invalid request origin.", 403);
  }
  await destroyCurrentSession();
  return Response.json({ ok: true });
}
