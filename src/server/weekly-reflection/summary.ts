import "server-only";
import type { DailyAggregate } from "../analytics/data";
import { weeklySummarySchema, type WeeklySummary } from "../../features/weekly-reflection/schemas";

export function buildWeeklySummary(
  daily: DailyAggregate[],
  dates: string[],
  topThemes: WeeklySummary["topThemes"]
): WeeklySummary {
  const sum = (
    key: "count" | "moodSum" | "energySum" | "energyCount" | "sleepSum" | "sleepCount"
  ) => daily.reduce((total, day) => total + (day[key] ?? 0), 0);
  const mean = (total: number, n: number) => (n ? Math.round((total / n) * 100) / 100 : null);
  const byDate = new Map(daily.map((day) => [day.date, day]));
  return weeklySummarySchema.parse({
    period: { startDate: dates[0], endDate: dates[6], timeZone: "UTC" },
    journalCount: sum("count"),
    recordedDays: daily.filter((day) => day.count > 0).length,
    averageMood: mean(sum("moodSum"), sum("count")),
    averageEnergy: mean(sum("energySum"), sum("energyCount")),
    days: dates.map((date) => {
      const day = byDate.get(date);
      return {
        date,
        entries: day?.count ?? 0,
        averageMood: day ? mean(day.moodSum, day.count) : null,
        averageSleepHours: day ? mean(day.sleepSum ?? 0, day.sleepCount) : null,
      };
    }),
    sleep: {
      averageHours: mean(sum("sleepSum"), sum("sleepCount")),
      recordedEntries: sum("sleepCount"),
      missingEntries: sum("count") - sum("sleepCount"),
    },
    exercise: {
      exerciseDays: daily.filter((day) => day.exerciseYes > 0 && day.exerciseNo === 0).length,
      nonExerciseDays: daily.filter((day) => day.exerciseNo > 0 && day.exerciseYes === 0).length,
      unknownDays: 7 - daily.filter((day) => day.exerciseYes + day.exerciseNo > 0).length,
      conflictingDays: daily.filter((day) => day.exerciseYes > 0 && day.exerciseNo > 0).length,
    },
    topThemes,
  });
}
