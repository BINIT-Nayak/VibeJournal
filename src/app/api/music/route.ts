import { ZodError } from "zod";
import { requireUser } from "@/server/auth/session";
import { getMusicSource, getMusicRecommendations } from "@/server/music/service";
import { MusicProviderError } from "@/server/music/provider";

const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status =
    message === "UNAUTHORIZED"
      ? 401
      : message === "Invalid request origin."
        ? 403
        : error instanceof ZodError || error instanceof SyntaxError || message === "ENERGY_REQUIRED"
          ? 400
          : error instanceof MusicProviderError
            ? 502
            : 500;
  return Response.json(
    {
      error: {
        code:
          status === 502 ? "PROVIDER_ERROR" : status === 401 ? "UNAUTHORIZED" : "REQUEST_FAILED",
        message:
          status === 401
            ? "Please sign in to view music."
            : status === 502
              ? "The music provider is unavailable. Please try again."
              : status === 400
                ? "Choose a valid intent and energy for this session."
                : "Could not load music right now.",
      },
    },
    { status, headers }
  );
}
export async function GET() {
  try {
    return Response.json({ source: await getMusicSource((await requireUser()).id) }, { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json(
      {
        recommendations: await getMusicRecommendations(
          user.id,
          await request.json(),
          request.signal
        ),
      },
      { headers }
    );
  } catch (error) {
    return failure(error);
  }
}
