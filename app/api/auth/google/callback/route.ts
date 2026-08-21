import { cookies } from "next/headers";
import { createSession, normalizeEmail, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleUserInfoUrl = "https://www.googleapis.com/oauth2/v3/userinfo";
const oauthStateCookie = "vibejournal_oauth_state";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  sub?: string;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get(oauthStateCookie)?.value;

  cookieStore.delete(oauthStateCookie);

  if (!code || !state || !storedState || state !== storedState) {
    return redirectWithAuthError(request, "Google login could not be verified. Please try again.");
  }

  const token = await exchangeCodeForToken(request, code);
  if (!token.access_token) {
    return redirectWithAuthError(request, "Google login failed before profile access.");
  }

  const profile = await getGoogleProfile(token.access_token);
  if (!profile.sub || !profile.email || !profile.email_verified) {
    return redirectWithAuthError(request, "Google account email must be verified.");
  }

  const email = normalizeEmail(profile.email);
  const user = await upsertGoogleUser({
    email,
    name: profile.name ?? null,
    subject: profile.sub,
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const session = await createSession(user.id);
  await setSessionCookie(session.token, session.expiresAt);

  return Response.redirect(new URL("/", getAppUrl(request)));
}

async function upsertGoogleUser(profile: { email: string; name: string | null; subject: string }) {
  const existingByGoogle = await prisma.user.findUnique({
    where: { googleSubject: profile.subject },
  });

  if (existingByGoogle) {
    return prisma.user.update({
      where: { id: existingByGoogle.id },
      data: { name: existingByGoogle.name ?? profile.name },
    });
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });

  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        googleSubject: profile.subject,
        name: existingByEmail.name ?? profile.name,
      },
    });
  }

  return prisma.user.create({
    data: {
      authProvider: "google",
      email: profile.email,
      googleSubject: profile.subject,
      name: profile.name,
      settings: { create: {} },
    },
  });
}

async function exchangeCodeForToken(request: Request, code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { error: "missing_oauth_config" };
  }

  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${getAppUrl(request)}/api/auth/google/callback`,
    }),
  });

  return (await response.json()) as GoogleTokenResponse;
}

async function getGoogleProfile(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(googleUserInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return (await response.json()) as GoogleUserInfo;
}

function redirectWithAuthError(request: Request, message: string) {
  const url = new URL("/", getAppUrl(request));
  url.searchParams.set("auth_error", message);

  return Response.redirect(url);
}

function getAppUrl(request: Request) {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin
  ).replace(/\/$/, "");
}
