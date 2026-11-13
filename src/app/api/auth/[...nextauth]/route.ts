import type { NextRequest } from "next/server";
import { handlers } from "@/server/auth/config";
import { credentialsSchema } from "@/features/auth/schemas";
import { RateLimitError, rateLimitResponse, rateLimitRetryAfter } from "@/server/rate-limit";

export const GET = handlers.GET;
export async function POST(request: NextRequest) {
  const copy = request.clone();
  const response = await handlers.POST(request);
  // Auth.js normally represents credentials errors as redirects, sometimes in JSON.
  const destination =
    response.headers.get("location") ??
    (response.headers.get("content-type")?.includes("application/json")
      ? (
          await response
            .clone()
            .json()
            .catch(() => null)
        )?.url
      : null);
  if (
    typeof destination === "string" &&
    new URL(destination, request.url).searchParams.get("code") === "rate_limited"
  ) {
    const body = copy.headers.get("content-type")?.includes("application/json")
      ? await copy.json().catch(() => null)
      : Object.fromEntries(await copy.formData().catch(() => new FormData()));
    const email = credentialsSchema.shape.email.safeParse(body?.email);
    const retryAfter = email.success ? await rateLimitRetryAfter("login", email.data) : 900;
    return rateLimitResponse(new RateLimitError(retryAfter), true);
  }
  return response;
}
