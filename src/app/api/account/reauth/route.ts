import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { googleEnabled, signIn } from "@/server/auth/config";
import { beginGoogleDeletionReauth, deletionTokenHash } from "@/server/account-deletion/reauth";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/server/rate-limit";

export async function GET(request: Request) {
  try {
    const actor = await requireUser(request);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { passwordHash: true },
    });
    const hash = await deletionTokenHash();
    const proof = hash
      ? await prisma.accountDeletionChallenge.findFirst({
          where: {
            tokenHash: hash,
            userId: actor.id,
            verifiedAt: { not: null },
            expiresAt: { gt: new Date() },
          },
        })
      : null;
    return Response.json(
      { method: user.passwordHash ? "password" : "google", verified: Boolean(proof) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requireUser(request);
    await enforceRateLimit("account-delete", actor.id);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (user.passwordHash || !user.googleSubject || !googleEnabled)
      return Response.json(
        { error: "Google re-authentication is unavailable for this account." },
        { status: 400 }
      );
    await beginGoogleDeletionReauth(actor.id);
    const url = await signIn(
      "google",
      { redirect: false, redirectTo: "/dashboard?deleteAccount=1#profile" },
      { prompt: "select_account", max_age: "0", login_hint: user.email }
    );
    return Response.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error, true);
    const status =
      error instanceof Error && error.message === "Invalid request origin."
        ? 403
        : error instanceof Error && error.message === "UNAUTHORIZED"
          ? 401
          : 503;
    return Response.json(
      { error: "Could not start account verification. Please try again." },
      { status }
    );
  }
}
