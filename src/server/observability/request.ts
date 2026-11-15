import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { logServer, requestContext } from "./logger";
import { observedRoutes } from "./routes";

type Route = (typeof observedRoutes)[number];
export function observeRoute<R extends Request, A extends unknown[]>(
  route: Route,
  handler: (request: R, ...args: A) => Response | Promise<Response>
) {
  return async (request: R, ...args: A): Promise<Response> => {
    // Always generate locally: incoming correlation headers are untrusted input.
    const requestId = randomUUID();
    return requestContext.run({ requestId }, async () => {
      const start = performance.now();
      let response: Response;
      let failed = false;
      try {
        response = await handler(request, ...args);
      } catch (error) {
        // Preserve Next.js redirect/not-found control flow without logging its payload.
        unstable_rethrow(error);
        failed = true;
        response = Response.json(
          { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      const status = response.status;
      logServer({
        event: failed || status >= 500 ? "request.failed" : "request.completed",
        level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        route,
        method: request.method as Parameters<typeof logServer>[0]["method"],
        status,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
      // Copy to support responses with immutable headers (e.g. redirects).
      const headers = new Headers(response.headers);
      headers.set("X-Request-ID", requestId);
      return new Response(response.body, { status, statusText: response.statusText, headers });
    });
  };
}
