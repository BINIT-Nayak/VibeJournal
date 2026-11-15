import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { observedRoutes } from "./routes";

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();
const recordSchema = z.object({
  event: z.enum([
    "request.completed",
    "request.failed",
    "auth.error",
    "auth.warning",
    "redis.unavailable",
    "audit.unavailable",
    "database.query",
  ]),
  level: z.enum(["info", "warn", "error"]),
  route: z.enum(observedRoutes).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
  status: z.number().int().min(100).max(599).optional(),
  durationMs: z.number().finite().nonnegative().optional(),
});
type LogRecord = z.input<typeof recordSchema>;

// Rebuild from an allowlist at runtime. Never serialize arbitrary objects, messages,
// error causes/stacks, headers, URLs, bodies, user IDs, SQL, or provider output.
export function logServer(record: LogRecord): void {
  const parsed = recordSchema.safeParse(record);
  if (!parsed.success) return;
  const id = requestContext.getStore()?.requestId;
  const requestId = id && z.uuid().safeParse(id).success ? id : undefined;
  try {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...parsed.data,
        requestId,
      })
    );
  } catch {
    // Observability must not change request success or trigger recursive logging.
  }
}
