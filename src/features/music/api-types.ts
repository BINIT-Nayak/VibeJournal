import type { MusicPreferences } from "./preferences";
import type { MusicCriteria, MusicEmotion, MusicIntent } from "./schemas";

export const musicIntentLabels: Record<MusicIntent, string> = {
  match: "Match my mood",
  uplift: "Lift my mood",
  calm: "Calm me down",
  focus: "Help me focus",
};
export type MusicSource = {
  preferences: MusicPreferences;
  mood: number;
  energy: number | null;
  primaryEmotion: MusicEmotion | null;
  recordedAt: string;
} | null;
export type MusicTrack = { id: string; title: string; artist: string; url: string; reason: string };
export type MusicRecommendations = {
  criteria: MusicCriteria;
  tracks: MusicTrack[];
  provider: string;
  note: string;
};
