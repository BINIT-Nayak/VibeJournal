import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { jsonError } from "@/lib/api";

const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const oauthStateCookie = "vibejournal_oauth_state";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return jsonError("Google OAuth is not configured.", 503);
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = getGoogleRedirectUri(request);
  const cookieStore = await cookies();

  cookieStore.set(oauthStateCookie, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const url = new URL(googleAuthUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return Response.redirect(url);
}

function getGoogleRedirectUri(request: Request) {
  const appUrl =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  return `${appUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}
