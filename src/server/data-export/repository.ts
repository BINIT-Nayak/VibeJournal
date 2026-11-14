import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { entryInclude } from "../journal/repository";

// A consistent snapshot, scoped by the server-authenticated actor on every query.
export function readExportSnapshot(userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const account = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          authProvider: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const settings = await tx.userSettings.findUnique({ where: { userId } });
      const journals = await tx.journalEntry.findMany({
        where: { userId },
        include: entryInclude,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const analyses = await tx.journalAnalysis.findMany({
        where: { userId, journalEntry: { userId } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const tags = await tx.tag.findMany({ where: { userId }, orderBy: { id: "asc" } });
      const musicHistory = await tx.playlistRun.findMany({
        where: { userId },
        select: {
          id: true,
          mood: true,
          intent: true,
          provider: true,
          externalUrl: true,
          tracks: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const securityAuditEvents = await tx.securityAuditEvent.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          event: true,
          outcome: true,
          reason: true,
          provider: true,
          enabled: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return { account, settings, journals, analyses, tags, musicHistory, securityAuditEvents };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 }
  );
}
