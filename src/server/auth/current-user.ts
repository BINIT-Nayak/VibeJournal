import "server-only";

import type { ClientUser } from "@/features/auth/types";
import { serializeSettings } from "@/server/api";
import { prisma } from "@/server/db";
import { listEntries } from "@/server/journal/service";

// Call only with an identity verified by Auth.js, never a request-body user ID.
export async function currentUserPayload(user: ClientUser) {
  const [entries, settings] = await Promise.all([
    listEntries(user),
    prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    }),
  ]);
  return { user, entries, settings: serializeSettings(settings) };
}
