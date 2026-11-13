import "server-only";
import { getMusicPreferences } from "./preferences";
import { z } from "zod";
import { prisma } from "../db";
import {
  musicIntentSchema,
  musicTimeOfDaySchema,
  musicEmotionSchema,
} from "../../features/music/schemas";
import { recommendMusicCriteria } from "../../features/music/recommendation-service";
import type { MusicSource, MusicRecommendations } from "../../features/music/api-types";
import { createItunesProvider } from "./itunes";
import type { MusicProvider } from "./provider";

export const musicRequestSchema = z.strictObject({
  intent: musicIntentSchema,
  timeOfDay: musicTimeOfDaySchema,
  energy: z.number().int().min(1).max(10).optional(),
});
export async function getMusicSource(userId: string): Promise<MusicSource> {
  if (!userId) throw new Error("UNAUTHORIZED");
  const entry = await prisma.journalEntry.findFirst({
    where: { userId, archivedAt: null, createdAt: { lte: new Date() } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { moodScore: true, energyScore: true, mood: true, createdAt: true },
  });
  if (!entry) return null;
  return {
    preferences: await getMusicPreferences(userId),
    mood: entry.moodScore,
    energy: entry.energyScore,
    primaryEmotion: musicEmotionSchema.safeParse(entry.mood).data ?? null,
    recordedAt: entry.createdAt.toISOString(),
  };
}
export async function getMusicRecommendations(
  userId: string,
  input: unknown,
  signal?: AbortSignal,
  provider: MusicProvider = createItunesProvider()
): Promise<MusicRecommendations | null> {
  const request = musicRequestSchema.parse(input);
  const source = await getMusicSource(userId);
  if (!source) return null;
  const energy = source.energy ?? request.energy;
  if (energy === undefined) throw new Error("ENERGY_REQUIRED");
  const criteria = recommendMusicCriteria(
    {
      mood: source.mood,
      energy,
      primaryEmotion: source.primaryEmotion,
      intent: request.intent,
      timeOfDay: request.timeOfDay,
    },
    source.preferences
  );
  return {
    criteria,
    tracks: await provider.recommend(criteria, signal),
    provider: "iTunes",
    note: "Catalog search suggestions, not measured audio-feature matches. Language choices guide search but track language cannot be verified. Disliked genres and explicit exclusions use catalog labels; unverified exclusions are omitted. Availability may vary by region.",
  };
}
