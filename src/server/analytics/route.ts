import "server-only";
import { ZodError } from "zod";
import { requireUser } from "@/server/auth/session";
import { getAnalytics } from "./service";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return Response.json(
      await getAnalytics(await requireUser(), {
        days: new URL(request.url).searchParams.get("days") ?? undefined,
      }),
      { headers }
    );
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    const invalid = error instanceof ZodError;
    return Response.json(
      {
        error: {
          code: unauthorized ? "UNAUTHORIZED" : invalid ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
          message: unauthorized
            ? "Please sign in to view analytics."
            : invalid
              ? "Choose between 1 and 90 days."
              : "Analytics are temporarily unavailable. Please try again.",
        },
      },
      { status: unauthorized ? 401 : invalid ? 400 : 500, headers }
    );
  }
}
