import type { buildInsight, getPlaylistSuggestion, moods } from "@/lib/mood";
import type { FormEvent } from "react";
import type { MoodEntry, MoodKey } from "@/lib/mood";

export type Screen = "home" | "new" | "journal" | "insights" | "music" | "profile";

export type InsightTab = "daily" | "weekly" | "monthly" | "patterns";

export type MoodMeta = (typeof moods)[number];

export type Insight = ReturnType<typeof buildInsight>;

export type PlaylistSuggestion = ReturnType<typeof getPlaylistSuggestion>;

export type EntryFormState = {
  customTag: string;
  energy: number;
  mood: MoodKey;
  note: string;
  selectedTags: string[];
  stress: number;
};

export type EntryFormActions = {
  onCustomTag: (value: string) => void;
  onEnergy: (value: number) => void;
  onMood: (value: MoodKey) => void;
  onNote: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onStress: (value: number) => void;
  onToggleTag: (tag: string) => void;
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
