export type ClientUser = {
  id: string;
  email: string;
  name: string | null;
};

export type ClientSettings = {
  aiConsent: boolean;
  darkMode: boolean;
  privacyAcknowledged: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  spotifyConnected: boolean;
};
