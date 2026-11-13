import "server-only";
import { createClient } from "redis";

function createConnection(url: string) {
  return createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: 1000, reconnectStrategy: false },
  });
}
type Client = ReturnType<typeof createConnection>;
let connection: Promise<Client> | undefined;
let retryAt = 0;
let lastWarning = 0;

export function reportRedisFailure() {
  if (Date.now() - lastWarning > 60_000) {
    // Never log connection URLs, credentials, user identifiers or cached values.
    console.warn("Redis unavailable; using PostgreSQL fallbacks.");
    lastWarning = Date.now();
  }
}

async function connect() {
  const url = process.env.REDIS_URL;
  if (!url || Date.now() < retryAt) return null;
  if (!connection) {
    const client = createConnection(url);
    client.on("error", reportRedisFailure);
    connection = client
      .connect()
      .then(() => client)
      .catch((error: unknown) => {
        connection = undefined;
        retryAt = Date.now() + 10_000;
        if (client.isOpen) client.destroy();
        throw error;
      });
  }
  return connection;
}

// Optional acceleration only: callers handle null using their durable fallback.
export async function redisCommand(args: string[]): Promise<unknown> {
  let client: Client | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    client = await connect();
    if (!client) return null;
    return await Promise.race([
      client.sendCommand(args),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Redis timeout")), 1000);
      }),
    ]);
  } catch {
    if (client?.isOpen) client.destroy();
    connection = undefined;
    retryAt = Date.now() + 10_000;
    reportRedisFailure();
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
