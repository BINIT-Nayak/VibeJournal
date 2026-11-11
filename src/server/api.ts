import "server-only";

import type { Mood, UserSettings } from "@prisma/client";
import type { MoodEntry as ClientMoodEntry, MoodKey } from "@/features/journal/mood";

import type { JournalEntryWithTags } from "@/server/journal/entries";

import type { ClientSettings } from "@/features/auth/types";

export function serializeEntry(entry: JournalEntryWithTags): ClientMoodEntry {
  return {
    id: entry.id,
    title: entry.title,
    mood: (entry.mood ?? "neutral") as MoodKey,
    energy: entry.energyScore ?? 5,
    stress: entry.stress ?? 5,
    valence: entry.moodScore,
    note: entry.content,
    tags: entry.tags.map((link) => link.tag.name),
    sleepHours: entry.sleepHours ?? undefined,
    exerciseMinutes: entry.exerciseMinutes ?? undefined,
    socialLevel: entry.socialScore ?? undefined,
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
