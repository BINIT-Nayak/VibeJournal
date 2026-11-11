import "server-only";

import { googleEnabled, signIn } from "@/server/auth/config";
import { jsonError } from "@/lib/http";

export async function GET() {
  if (!googleEnabled) return jsonError("Google OAuth is not configured.", 503);
  const url = await signIn("google", { redirect: false, redirectTo: "/dashboard" });
  return Response.redirect(url);
}
