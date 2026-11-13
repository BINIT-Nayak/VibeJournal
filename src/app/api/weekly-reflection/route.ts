import { RateLimitError, rateLimitResponse } from "@/server/rate-limit";
import { requireUser } from "@/server/auth/session";
import {
  generateWeeklyReflection,
  getWeeklyPreview,
  WeeklyReflectionError,
} from "@/server/weekly-reflection/service";

const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  if (error instanceof RateLimitError) return rateLimitResponse(error);
  const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
  const known = error instanceof WeeklyReflectionError;
  return Response.json(
    {
      error: {
        code: unauthorized ? "UNAUTHORIZED" : known ? error.code : "REFLECTION_UNAVAILABLE",
        message: unauthorized
          ? "Please sign in."
          : known
            ? error.message
            : "Weekly reflection is unavailable. Please try again later.",
      },
    },
    {
      status: unauthorized ? 401 : known ? (error.code === "CONSENT_REQUIRED" ? 403 : 422) : 503,
      headers,
    }
  );
}
export async function GET() {
  try {
    return Response.json(await getWeeklyPreview((await requireUser()).id), { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    // Accept no source data or user IDs from the browser.
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length)
      return Response.json(
        { error: { code: "INVALID_REQUEST", message: "Send an empty object." } },
        { status: 400, headers }
      );
    return Response.json(await generateWeeklyReflection(user.id, request.signal), { headers });
  } catch (error) {
    return failure(error);
  }
}
