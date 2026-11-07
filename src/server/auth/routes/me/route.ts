import "server-only";

import { getCurrentUser } from "@/server/auth/session";
import { serializeEntry, serializeSettings } from "@/server/api";
import { prisma } from "@/server/db";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ user: null });
  }

  const [entries, settings] = await Promise.all([
    prisma.moodEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    }),
  ]);

  return Response.json({
    user,
    entries: entries.map(serializeEntry),
    settings: serializeSettings(settings),
  });
}
