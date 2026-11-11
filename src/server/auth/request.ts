import "server-only";

// Server-side Auth.js signIn/signOut bypass its HTTP CSRF check. These custom
// JSON endpoints therefore require a browser Origin matching the configured app.
export function isSameOriginRequest(request: Request) {
  const expected = new URL(process.env.AUTH_URL || request.url).origin;
  return (
    request.headers.get("origin") === expected &&
    request.headers.get("sec-fetch-site") !== "cross-site" &&
    request.headers.get("content-type")?.split(";")[0].trim() === "application/json"
  );
}
