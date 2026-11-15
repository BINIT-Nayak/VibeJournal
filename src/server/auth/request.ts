import "server-only";
import { getServerEnv } from "../env";

// Server-side Auth.js signIn/signOut bypass its HTTP CSRF check. These custom
// JSON endpoints therefore require a browser Origin matching the configured app.
export function isSameOriginRequest(request: Request) {
  const expected = new URL(getServerEnv().AUTH_URL).origin;
  return (
    request.headers.get("origin") === expected &&
    request.headers.get("sec-fetch-site") !== "cross-site" &&
    request.headers.get("content-type")?.split(";")[0].trim() === "application/json"
  );
}
