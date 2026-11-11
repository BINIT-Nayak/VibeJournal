import "server-only";
import type { MoodTrendPoint } from "@/features/analytics/types";
import type { DailyAggregate } from "./data";

/** One ascending point per UTC calendar day. A gap is unknown, never zero. */
export function buildMoodTrend(daily: DailyAggregate[], dates: string[]): MoodTrendPoint[] {
  const byDate = new Map(daily.map((day) => [day.date, day]));
  return dates.map((date) => {
    const day = byDate.get(date);
    return {
      date,
      averageMood: day && day.count > 0 ? Math.round((day.moodSum / day.count) * 100) / 100 : null,
      averageEnergy:
        day && day.energyCount > 0
          ? Math.round(((day.energySum ?? 0) / day.energyCount) * 100) / 100
          : null,
      journalCount: day?.count ?? 0,
    };
  });
}
