import { getCurrentUser } from "@/lib/auth";
import { serializeEntry, serializeSettings } from "@/lib/api";
import { prisma } from "@/lib/prisma";

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
