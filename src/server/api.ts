import "server-only";

import type { Mood, MoodEntry, UserSettings } from "@prisma/client";
import type { MoodEntry as ClientMoodEntry, MoodKey } from "@/features/journal/mood";

import type { ClientSettings } from "@/features/auth/types";

export function serializeEntry(entry: MoodEntry): ClientMoodEntry {
  return {
    id: entry.id,
    mood: entry.mood as MoodKey,
    energy: entry.energy,
    stress: entry.stress,
    valence: entry.valence,
    note: entry.note ?? "",
    tags: entry.tags,
    sleepHours: entry.sleepHours ?? undefined,
    exerciseMinutes: entry.exerciseMinutes ?? undefined,
    socialLevel: entry.socialLevel ?? undefined,
    voiceNote: entry.voiceNote ?? undefined,
    photoNames: entry.photoNames,
    archivedAt: entry.archivedAt?.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function serializeSettings(settings: UserSettings): ClientSettings {
  return {
    aiConsent: settings.aiConsent,
    darkMode: settings.darkMode,
    privacyAcknowledged: settings.privacyAcknowledged,
    reminderEnabled: settings.reminderEnabled,
    reminderTime: settings.reminderTime,
    spotifyConnected: settings.spotifyConnected,
  };
}

export function parseMood(value: unknown): Mood {
  const moods = ["joyful", "calm", "anxious", "sad", "angry", "tired", "hopeful", "neutral"];
  if (typeof value === "string" && moods.includes(value)) {
    return value as Mood;
  }

  throw new Error("Choose a valid mood.");
}
