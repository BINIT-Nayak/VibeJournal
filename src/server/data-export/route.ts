import "server-only";
import { requireUser } from "../auth/session";
import { exportUserData } from "./service";
import { EncryptionError } from "../encryption/envelope";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

export async function GET(request: Request) {
  try {
    const actor = await requireUser(request);
    // No owner IDs, filters or partial-export controls are accepted from the client.
    if (new URL(request.url).search)
      return Response.json(
        {
          error: {
            code: "INVALID_QUERY",
            message: "This export does not accept query parameters.",
          },
        },
        { status: 400, headers }
      );
    const payload = await exportUserData(actor);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="vibejournal-data-' + payload.exportedAt.slice(0, 10) + '.json"',
      },
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    const status = unauthorized ? 401 : error instanceof EncryptionError ? 503 : 500;
    return Response.json(
      {
        error: {
          code: unauthorized ? "UNAUTHORIZED" : "EXPORT_UNAVAILABLE",
          message: unauthorized
            ? "Please log in to download your data."
            : "Your data export is temporarily unavailable. Please try again.",
        },
      },
      { status, headers }
    );
  }
}
