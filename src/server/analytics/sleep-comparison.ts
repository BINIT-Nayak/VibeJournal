import "server-only";
import type { SleepMoodComparison } from "@/features/analytics/types";
import type { DailyAggregate } from "./data";

/** Each UTC day counts once, using its recorded sleep mean and daily mood mean. */
export function calculateSleepComparison(
  days: DailyAggregate[]
): Omit<SleepMoodComparison, "summary"> {
  const higher: number[] = [];
  const lower: number[] = [];
  let excluded = 0;
  for (const day of days) {
    if (day.count === 0) continue;
    if (day.sleepCount === 0 || day.sleepSum === null) {
      excluded++;
      continue;
    }
    // Classify unrounded sleep values: 6.999 hours must remain below 7.
    const group = day.sleepSum / day.sleepCount >= 7 ? higher : lower;
    group.push(day.moodSum / day.count);
  }
  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);
  const highMean = mean(higher),
    lowMean = mean(lower);
  const enough = higher.length >= 5 && lower.length >= 5;
  return {
    thresholdHours: 7,
    minimumDaysPerGroup: 5,
    sampleUnit: "day",
    status: enough ? "available" : "insufficient_data",
    atLeast7Hours: { sampleSize: higher.length, averageMood: round(highMean) },
    lessThan7Hours: { sampleSize: lower.length, averageMood: round(lowMean) },
    excludedDaysWithoutSleep: excluded,
    moodDifference: enough ? round(highMean! - lowMean!) : null,
  };
}
