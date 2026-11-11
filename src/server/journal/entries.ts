import "server-only";

import type { Prisma } from "@prisma/client";

export const entryInclude = {
  tags: { include: { tag: true }, orderBy: { position: "asc" as const } },
} satisfies Prisma.JournalEntryInclude;

export type JournalEntryWithTags = Prisma.JournalEntryGetPayload<{
  include: typeof entryInclude;
}>;

export async function setEntryTags(
  tx: Prisma.TransactionClient,
  journalEntryId: string,
  userId: string,
  values: string[]
) {
  await tx.journalTag.deleteMany({ where: { journalEntryId, userId } });
  const names = [...new Set(values.filter((value) => value.trim()))];
  for (const [position, name] of names.entries()) {
    const tag = await tx.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
    });
    await tx.journalTag.create({ data: { journalEntryId, tagId: tag.id, userId, position } });
  }
}
