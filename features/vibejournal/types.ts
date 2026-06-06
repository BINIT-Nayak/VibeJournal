import type { buildInsight, getPlaylistSuggestion, moods } from "@/lib/mood";
import type { FormEvent } from "react";
import type { MoodEntry, MoodKey } from "@/lib/mood";
import type { ClientSettings, ClientUser } from "@/lib/api";

export type Screen = "home" | "new" | "journal" | "insights" | "music" | "profile";

export type InsightTab = "daily" | "weekly" | "monthly" | "patterns";

export type MoodMeta = (typeof moods)[number];

export type Insight = ReturnType<typeof buildInsight>;

export type PlaylistSuggestion = ReturnType<typeof getPlaylistSuggestion>;

export type EntryFormState = {
  customTag: string;
  energy: number;
  exerciseMinutes: number;
  mood: MoodKey;
  note: string;
  photoNames: string[];
  selectedTags: string[];
  sleepHours: number;
  socialLevel: number;
  stress: number;
  voiceNote: string;
  isEditing: boolean;
};

export type EntryFormActions = {
  onCustomTag: (value: string) => void;
  onEnergy: (value: number) => void;
  onExerciseMinutes: (value: number) => void;
  onMood: (value: MoodKey) => void;
  onNote: (value: string) => void;
  onPhotoNames: (value: string[]) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSleepHours: (value: number) => void;
  onSocialLevel: (value: number) => void;
  onStress: (value: number) => void;
  onToggleTag: (tag: string) => void;
  onVoiceNote: (value: string) => void;
};

export type JournalFilters = {
  moodFilter: "all" | MoodKey;
  query: string;
  tagFilter: string;
};

export type JournalFilterActions = {
  onMoodFilter: (value: "all" | MoodKey) => void;
  onQuery: (value: string) => void;
  onTagFilter: (value: string) => void;
};

export type EntriesProps = {
  entries: MoodEntry[];
};

export type UserSession = {
  entries: MoodEntry[];
  settings: ClientSettings;
  user: ClientUser;
};
