import { requireUser } from "@/server/auth/session";
import { getMusicPreferences } from "@/server/music/preferences";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return Response.json(
      { preferences: await getMusicPreferences((await requireUser()).id) },
      { headers }
    );
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return Response.json(
      {
        error: { message: unauthorized ? "Please sign in." : "Could not load music preferences." },
      },
      { status: unauthorized ? 401 : 500, headers }
    );
  }
}
