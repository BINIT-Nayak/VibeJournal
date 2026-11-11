import "server-only";

import type { ClientUser } from "@/features/auth/types";
import { serializeEntry, serializeSettings } from "@/server/api";
import { prisma } from "@/server/db";
import { entryInclude } from "@/server/journal/entries";

// Call only with an identity verified by Auth.js, never a request-body user ID.
export async function currentUserPayload(user: ClientUser) {
  const [entries, settings] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: entryInclude,
    }),
    prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    }),
  ]);
  return { user, entries: entries.map(serializeEntry), settings: serializeSettings(settings) };
}
