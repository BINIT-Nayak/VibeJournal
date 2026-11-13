import "server-only";
import { prisma } from "../db";
import { defaultMusicPreferences, musicPreferencesSchema } from "../../features/music/preferences";

export async function getMusicPreferences(userId: string) {
  if (!userId) throw new Error("UNAUTHORIZED");
  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      favoriteGenres: true,
      dislikedGenres: true,
      preferredLanguages: true,
      allowExplicit: true,
    },
  });
  return musicPreferencesSchema.parse(row ?? defaultMusicPreferences);
}
