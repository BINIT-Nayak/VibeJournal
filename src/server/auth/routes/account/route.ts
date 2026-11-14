import "server-only";
import { destroyCurrentSession, requireUser } from "@/server/auth/session";
import { deleteOwnAccount, DeletionError } from "@/server/account-deletion/service";
import { deletionTokenHash, clearDeletionCookie } from "@/server/account-deletion/reauth";
import { RateLimitError, rateLimitResponse } from "@/server/rate-limit";

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    await deleteOwnAccount(user.id, await request.json(), await deletionTokenHash());
    // Deletion is already committed. Cookie cleanup failure must not report a false rollback.
    try {
      await clearDeletionCookie();
      await destroyCurrentSession();
    } catch {
      /* All server sessions are revoked. */
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error, true);
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    const origin = error instanceof Error && error.message === "Invalid request origin.";
    const status = unauthorized
      ? 401
      : origin
        ? 403
        : error instanceof DeletionError
          ? error.code === "REAUTH_REQUIRED"
            ? 401
            : 400
          : error instanceof SyntaxError
            ? 400
            : 503;
    return Response.json(
      {
        error: unauthorized
          ? "Please sign in to delete your account."
          : origin
            ? "Invalid request origin."
            : error instanceof DeletionError
              ? error.message
              : status === 400
                ? "Provide a valid confirmation."
                : "Account deletion is temporarily unavailable. Please try again.",
        code:
          error instanceof DeletionError
            ? error.code
            : unauthorized
              ? "UNAUTHORIZED"
              : "DELETION_FAILED",
      },
      { status, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
