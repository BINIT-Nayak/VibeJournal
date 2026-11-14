import "server-only";
import { prisma } from "../db";

export async function hasConsent(userId: string) {
  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: { aiConsent: true },
  });
  return row?.aiConsent === true;
}

export function readAnalysisPage(userId: string, start: Date, asOf: Date, after?: string) {
  return prisma.journalAnalysis.findMany({
    where: {
      userId,
      ...(after ? { id: { gt: after } } : {}),
      journalEntry: { userId, archivedAt: null, createdAt: { gte: start, lte: asOf } },
    },
    orderBy: { id: "asc" },
    take: 200,
    select: {
      id: true,
      journalEntryId: true,
      privatePayload: true,
      sourceUpdatedAt: true,
      journalEntry: { select: { createdAt: true, updatedAt: true } },
    },
  });
}
