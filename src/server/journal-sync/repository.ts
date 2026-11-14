import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { MutationResult } from "@/features/journal/sync/schemas";

export function transaction<T>(
  userId: string,
  key: string,
  entryId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>
) {
  return prisma.$transaction(
    async (tx) => {
      // Serialize both reused keys and different operations targeting one entry.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([userId, key, "key"])}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([userId, entryId, "entry"])}, 0))`;
      return work(tx);
    },
    { timeout: 10000 }
  );
}
export function receipt(tx: Prisma.TransactionClient, userId: string, key: string) {
  return tx.journalMutationReceipt.findUnique({ where: { userId_key: { userId, key } } });
}
export function previousMutation(tx: Prisma.TransactionClient, userId: string, entryId: string) {
  return tx.journalMutationReceipt.findFirst({ where: { userId, entryId } });
}
export function saveReceipt(
  tx: Prisma.TransactionClient,
  data: {
    userId: string;
    key: string;
    entryId: string;
    kind: string;
    payloadHash: string;
    result: MutationResult;
  }
) {
  return tx.journalMutationReceipt.create({ data });
}
