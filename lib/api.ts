import type { Mood, MoodEntry, UserSettings } from "@prisma/client";
import type { MoodEntry as ClientMoodEntry, MoodKey } from "@/lib/mood";

export type ClientUser = {
  id: string;
  email: string;
  name: string | null;
};

export type ClientSettings = {
  darkMode: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  spotifyConnected: boolean;
};

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

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
    darkMode: settings.darkMode,
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

export function parseNumber(value: unknown, fallback: number, min: number, max: number) {
  const nextValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, nextValue));
}

export function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}
