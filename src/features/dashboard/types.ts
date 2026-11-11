import type { ClientUser, ClientSettings } from "@/features/auth/types";
import type { MoodEntry } from "@/features/journal/mood";

export type DashboardResponse = {
  user: ClientUser;
  settings: ClientSettings;
  asOf: string;
  timeZone: string;
  period: { startDate: string; endDate: string; description: string };
  today: {
    date: string;
    hasJournaled: boolean;
    journalCount: number;
    latestEntryId: string | null;
  };
  weeklyAverageMood: number | null;
  averageEnergy: number | null;
  journalCount: number;
  weeklyJournalCount: number;
  moodTrend: Array<{ date: string; averageMood: number | null; journalCount: number }>;
  recentEntries: MoodEntry[];
  personalInsights: { status: "coming_soon"; message: string };
  musicRecommendations: { status: "coming_soon"; message: string };
};
