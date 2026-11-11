import "server-only";

// Retired callback: it must never issue a legacy session cookie.
export async function GET(request: Request) {
  return Response.redirect(
    new URL(
      "/login?auth_error=Please%20restart%20Google%20login.",
      process.env.AUTH_URL || request.url
    )
  );
}
