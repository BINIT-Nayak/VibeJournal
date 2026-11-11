import "server-only";
import type { AnalyticsStatistics } from "@/features/analytics/types";
import type { DailyAggregate, TagAggregate } from "./data";

const mean = (sum: number, count: number) => (count ? Math.round((sum / count) * 100) / 100 : null);

export function calculateStatistics(
  daily: DailyAggregate[],
  tags: TagAggregate[],
  dates: string[]
): AnalyticsStatistics {
  const sum = (key: keyof DailyAggregate) =>
    daily.reduce(
      (total, day) => total + (typeof day[key] === "number" ? (day[key] as number) : 0),
      0
    );
  const total = sum("count");
  const energyCount = sum("energyCount"),
    sleepCount = sum("sleepCount");
  const yes = sum("exerciseYes"),
    no = sum("exerciseNo");
  const sleepRows = daily.filter((day) => day.sleepCount > 0);
  return {
    journalCount: total,
    mood: { average: mean(sum("moodSum"), total), recordedCount: total, missingCount: 0 },
    energy: {
      average: mean(sum("energySum"), energyCount),
      recordedCount: energyCount,
      missingCount: total - energyCount,
    },
    sleep: {
      average: mean(sum("sleepSum"), sleepCount),
      recordedCount: sleepCount,
      missingCount: total - sleepCount,
      minHours: sleepRows.length ? Math.min(...sleepRows.map((day) => day.sleepMin!)) : null,
      maxHours: sleepRows.length ? Math.max(...sleepRows.map((day) => day.sleepMax!)) : null,
    },
    exercise: {
      yesCount: yes,
      noCount: no,
      missingCount: total - yes - no,
      averageMoodWhenExercised: mean(sum("yesMoodSum"), yes),
      averageMoodWhenNotExercised: mean(sum("noMoodSum"), no),
    },
    moodTrend: dates.map((date) => {
      const day = daily.find((item) => item.date === date);
      return {
        date,
        averageMood: day ? mean(day.moodSum, day.count) : null,
        averageEnergy: day ? mean(day.energySum ?? 0, day.energyCount) : null,
        journalCount: day?.count ?? 0,
      };
    }),
    tagFrequency: tags,
  };
}
