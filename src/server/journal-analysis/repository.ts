import "server-only";
import { prisma } from "../db";
import type { JournalAnalysis } from "../../features/journal-analysis/schemas";

export function findEligibleEntry(userId: string, id: string) {
  return prisma.journalEntry.findFirst({
    where: { id, userId, archivedAt: null, user: { settings: { aiConsent: true } } },
    select: { id: true, title: true, content: true, updatedAt: true },
  });
}

export function persistAnalysis(
  userId: string,
  journalEntryId: string,
  sourceUpdatedAt: Date,
  analysis: JournalAnalysis
) {
  return prisma.$transaction(async (tx) => {
    // Lock the matching source version so an edit/delete cannot race this insert.
    const entry = await tx.journalEntry.updateMany({
      where: { id: journalEntryId, userId, updatedAt: sourceUpdatedAt, archivedAt: null },
      data: { updatedAt: sourceUpdatedAt },
    });
    if (!entry.count) return false;
    // Recheck consent after the external call and lock it for this transaction.
    const consent = await tx.userSettings.updateMany({
      where: { userId, aiConsent: true },
      data: { aiConsent: true },
    });
    if (!consent.count) return false;
    await tx.journalAnalysis.upsert({
      where: { journalEntryId },
      create: { journalEntryId, userId, sourceUpdatedAt, ...analysis },
      update: { sourceUpdatedAt, ...analysis },
    });
    return true;
  });
}

export function findStoredAnalysis(userId: string, journalEntryId: string) {
  return prisma.journalAnalysis.findFirst({
    where: { journalEntryId, userId, journalEntry: { userId } },
    include: { journalEntry: { select: { updatedAt: true } } },
  });
}
