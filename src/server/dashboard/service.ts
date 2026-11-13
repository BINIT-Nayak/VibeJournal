import "server-only";
import { z } from "zod";
import type { ClientUser } from "@/features/auth/types";
import type { DashboardResponse } from "@/features/dashboard/types";
import { serializeEntry, serializeSettings } from "@/server/api";
import { readDashboard } from "./repository";

const querySchema = z.object({
  timeZone: z
    .string()
    .min(1)
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Use a valid IANA time zone.")
    .default("UTC"),
});
export class DashboardQueryError extends Error {
  constructor(readonly validation: z.ZodError) {
    super("Invalid dashboard query.");
  }
}

const round = (value: number | null) => (value == null ? null : Math.round(value * 100) / 100);

export async function getDashboard(user: ClientUser, query: unknown): Promise<DashboardResponse> {
  if (!user.id) throw new Error("UNAUTHORIZED");
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) throw new DashboardQueryError(parsed.error);
  const { timeZone } = parsed.data;
  const asOf = new Date();
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(asOf);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 6 + index);
    return date.toISOString().slice(0, 10);
  });
  const { stats, days, recent, settings } = await readDashboard(
    user.id,
    dates[0],
    today,
    timeZone,
    asOf
  );
  if (!settings) throw new Error("Missing account settings");
  return {
    user,
    settings: serializeSettings(settings),
    asOf: asOf.toISOString(),
    timeZone,
    period: {
      startDate: dates[0],
      endDate: today,
      description: "Today and the previous six calendar days",
    },
    today: {
      date: today,
      hasJournaled: stats.todayCount > 0,
      journalCount: stats.todayCount,
      latestEntryId: stats.todayCount ? (recent[0]?.id ?? null) : null,
    },
    weeklyAverageMood: round(stats.averageMood),
    averageEnergy: round(stats.averageEnergy),
    journalCount: stats.journalCount,
    weeklyJournalCount: stats.weeklyJournalCount,
    moodTrend: dates.map((date) => {
      const day = days.find((row) => row.date === date);
      return {
        date,
        averageMood: round(day?.averageMood ?? null),
        journalCount: day?.journalCount ?? 0,
      };
    }),
    recentEntries: recent.map(serializeEntry),
    personalInsights: {
      status: "coming_soon",
      message: "Personal insights will appear here in a future update.",
    },
    musicRecommendations: {
      status: "available",
      message: "Choose a listening intent to explore music for your latest mood.",
    },
  };
}
