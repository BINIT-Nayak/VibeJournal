import { logServer } from "@/server/observability/logger";
import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const client = new PrismaClient({
    log: process.env.PROFILE_DATABASE === "1" ? [{ emit: "event", level: "query" }] : [],
  });
  if (process.env.PROFILE_DATABASE === "1") {
    client.$on("query", (event) => {
      // Deliberately omit SQL and parameters: both can contain private user data.
      logServer({ event: "database.query", level: "info", durationMs: event.duration });
    });
  }
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
