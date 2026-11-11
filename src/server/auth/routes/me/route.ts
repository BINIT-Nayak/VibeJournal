import "server-only";

import { getCurrentUser } from "@/server/auth/session";
import { currentUserPayload } from "@/server/auth/current-user";

export async function GET() {
  const user = await getCurrentUser();
  return Response.json(user ? await currentUserPayload(user) : { user: null }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
