import type { MusicPreferences } from "@/features/music/preferences";
export type ClientUser = {
  id: string;
  email: string;
  name: string | null;
};

export type ClientSettings = {
  musicPreferences: MusicPreferences;
  aiConsent: boolean;
  darkMode: boolean;
  privacyAcknowledged: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  spotifyConnected: boolean;
};
