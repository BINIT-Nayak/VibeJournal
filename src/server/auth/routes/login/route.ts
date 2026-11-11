import "server-only";

import { AuthError, CredentialsSignin } from "next-auth";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { handlers, signIn } from "@/server/auth/config";
import { clearLegacyCookie } from "@/server/auth/session";
import { isSameOriginRequest } from "@/server/auth/request";
import { credentialsSchema } from "@/features/auth/schemas";
import { jsonError } from "@/lib/http";
import { currentUserPayload } from "@/server/auth/current-user";
import { prisma } from "@/server/db";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Invalid request origin.", 403);
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a valid email and password.");
  try {
    await signIn("credentials", { ...parsed.data, redirect: false, redirectTo: "/dashboard" });
    await clearLegacyCookie();
    // Validate the newly issued cookie through Auth.js. auth() reads the original
    // request headers, which do not yet contain this response cookie. Do not look
    // up by submitted email here: email can change concurrently after sign-in.
    const sessionResponse = await handlers.GET(
      new NextRequest(new URL("/api/auth/session", request.url), {
        headers: { cookie: (await cookies()).toString() },
      })
    );
    const session = await sessionResponse.json();
    if (!sessionResponse.ok || typeof session?.user?.id !== "string") {
      return jsonError("Could not verify the new session. Please sign in again.", 503);
    }
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true },
    });
    return Response.json(await currentUserPayload(user));
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "rate_limited") {
      return jsonError("Too many attempts. Try again in 15 minutes.", 429);
    }
    if (error instanceof AuthError && error.type === "CredentialsSignin") {
      return jsonError("Email or password is incorrect.", 401);
    }
    return jsonError("Login is temporarily unavailable.", 503);
  }
}
