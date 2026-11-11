import "server-only";

import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";

export const entryInclude = {
  tags: { include: { tag: true }, orderBy: { position: "asc" as const } },
} satisfies Prisma.JournalEntryInclude;

export type JournalEntryWithTags = Prisma.JournalEntryGetPayload<{
  include: typeof entryInclude;
}>;

async function setEntryTags(
  tx: Prisma.TransactionClient,
  journalEntryId: string,
  userId: string,
  values: string[]
) {
  await tx.journalTag.deleteMany({ where: { journalEntryId, userId } });
  for (const [position, name] of values.entries()) {
    const tag = await tx.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
    });
    await tx.journalTag.create({ data: { journalEntryId, tagId: tag.id, userId, position } });
  }
}

// Persistence only: the service supplies validated fields and the trusted owner.
type CreateData = Omit<Prisma.JournalEntryUncheckedCreateInput, "userId" | "tags">;
type UpdateData = Omit<Prisma.JournalEntryUncheckedUpdateManyInput, "id" | "userId">;

export function listByOwner(userId: string) {
  return prisma.journalEntry.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: entryInclude,
  });
}

export function findByOwner(userId: string, id: string) {
  return prisma.journalEntry.findFirst({ where: { id, userId }, include: entryInclude });
}

export function create(userId: string, data: CreateData, tags: string[]) {
  return prisma.$transaction(async (tx) => {
    const saved = await tx.journalEntry.create({ data: { ...data, userId } });
    await setEntryTags(tx, saved.id, userId, tags);
    return tx.journalEntry.findFirstOrThrow({
      where: { id: saved.id, userId },
      include: entryInclude,
    });
  });
}

export function updateByOwner(
  userId: string,
  id: string,
  expectedUpdatedAt: Date,
  data: UpdateData,
  tags?: string[]
) {
  return prisma.$transaction(async (tx) => {
    // Scope the write itself, not just an earlier read, to avoid ownership races.
    const result = await tx.journalEntry.updateMany({
      where: { id, userId, updatedAt: expectedUpdatedAt },
      data,
    });
    if (result.count === 0) return null;
    if (tags !== undefined) await setEntryTags(tx, id, userId, tags);
    return tx.journalEntry.findFirstOrThrow({ where: { id, userId }, include: entryInclude });
  });
}

export function deleteByOwner(userId: string, id: string) {
  return prisma.journalEntry.deleteMany({ where: { id, userId } });
}

export function deleteAllByOwner(userId: string) {
  return prisma.journalEntry.deleteMany({ where: { userId } });
}

export function pageByOwner(
  userId: string,
  take: number,
  cursor?: { id: string; createdAt: Date }
) {
  return prisma.journalEntry.findMany({
    where: {
      userId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: entryInclude,
  });
}
