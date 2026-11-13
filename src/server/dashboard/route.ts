import "server-only";
import { requireUser } from "@/server/auth/session";
import { getDashboard, DashboardQueryError } from "./service";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await requireUser();
    return Response.json(
      await getDashboard(user, {
        timeZone: new URL(request.url).searchParams.get("timeZone") ?? undefined,
      }),
      { headers }
    );
  } catch (error) {
    if (error instanceof DashboardQueryError)
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Use a valid time zone.",
            issues: error.validation.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        { status: 400, headers }
      );
    if (error instanceof Error && error.message === "UNAUTHORIZED")
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Please sign in to view your dashboard." } },
        { status: 401, headers }
      );
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Your dashboard is temporarily unavailable. Please try again.",
        },
      },
      { status: 500, headers }
    );
  }
}
