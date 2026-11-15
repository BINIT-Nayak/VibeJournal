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
      const table = event.query.match(/(?:FROM|INTO|UPDATE) "(?:public"\.")?([A-Za-z]+)"/)?.[1];
      console.info(
        "DB_PROFILE",
        JSON.stringify({ table: table ?? "transaction", ms: event.duration })
      );
    });
  }
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
