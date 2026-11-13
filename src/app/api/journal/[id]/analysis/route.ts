import { requireUser } from "@/server/auth/session";
import { getEntry, JournalNotFoundError } from "@/server/journal/service";
import { analyzeAndStoreEntry } from "@/server/journal-analysis/after-create";
import { RateLimitError, rateLimitResponse } from "@/server/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    await getEntry(user, id, true);
    const status = await analyzeAndStoreEntry(user.id, id);
    return Response.json(
      {
        status,
        message:
          status === "saved"
            ? "Analysis saved."
            : "Analysis requires consent and an unchanged, active entry.",
      },
      { status: status === "saved" ? 200 : 409, headers }
    );
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const status =
      error instanceof JournalNotFoundError
        ? 404
        : error instanceof Error && error.message === "UNAUTHORIZED"
          ? 401
          : error instanceof Error && error.message === "Invalid request origin."
            ? 403
            : 503;
    return Response.json(
      {
        error: {
          code: "ANALYSIS_UNAVAILABLE",
          message:
            status === 404
              ? "Entry not found."
              : status === 401
                ? "Please sign in."
                : "Analysis is unavailable. Your journal is unchanged.",
        },
      },
      { status, headers }
    );
  }
}
