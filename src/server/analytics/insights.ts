import "server-only";
import type {
  AnalyticsStatistics,
  AnalyticsCorrelation,
  AnalyticsInsight,
  SleepMoodComparison,
  ExerciseMetricComparison,
} from "@/features/analytics/types";

export function generateInsights(
  stats: AnalyticsStatistics,
  correlations: AnalyticsCorrelation[]
): AnalyticsInsight[] {
  if (!stats.journalCount)
    return [
      {
        id: "empty",
        kind: "empty",
        text: "No reflections in this period yet. A first entry will begin your history.",
      },
    ];
  const result: AnalyticsInsight[] = [
    {
      id: "mood-average",
      kind: "summary",
      text: `Your average mood was ${stats.mood.average}/10 across ${stats.journalCount} reflections in this period.`,
    },
  ];
  if (stats.energy.recordedCount)
    result.push({
      id: "energy",
      kind: "summary",
      text: `You recorded energy in ${stats.energy.recordedCount} reflections, averaging ${stats.energy.average}/10.`,
    });
  if (stats.sleep.recordedCount)
    result.push({
      id: "sleep",
      kind: "summary",
      text: `Recorded sleep averaged ${stats.sleep.average} hours across ${stats.sleep.recordedCount} reflections.`,
    });
  if (stats.exercise.yesCount + stats.exercise.noCount)
    result.push({
      id: "exercise",
      kind: "summary",
      text: `Exercise was marked yes in ${stats.exercise.yesCount} of ${stats.exercise.yesCount + stats.exercise.noCount} reflections with exercise recorded.`,
    });
  if (stats.tagFrequency[0])
    result.push({
      id: "top-tag",
      kind: "summary",
      text: `“${stats.tagFrequency[0].tag}” appeared in ${stats.tagFrequency[0].entryCount} reflections, making it a most-used tag among those with enough observations in this period.`,
    });
  for (const correlation of correlations) {
    if (
      correlation.status !== "available" ||
      correlation.coefficient === null ||
      Math.abs(correlation.coefficient) < 0.3
    )
      continue;
    const direction = correlation.coefficient > 0 ? "higher" : "lower";
    const subject =
      correlation.metric === "exercise"
        ? "Entries marked with exercise"
        : `Entries with ${correlation.metric === "sleep" ? "more recorded sleep" : "higher energy"}`;
    result.push({
      id: `association-${correlation.metric}`,
      kind: "association",
      text: `${subject} tended to have ${direction} mood scores across ${correlation.sampleCount} paired reflections (${correlation.distinctDays} days). This is an association in your entries, not evidence of cause and effect.`,
    });
  }
  return result;
}

export function describeSleepComparison(comparison: Omit<SleepMoodComparison, "summary">): string {
  const high = comparison.atLeast7Hours,
    low = comparison.lessThan7Hours;
  if (comparison.status === "insufficient_data") {
    return `Not enough data to compare yet: ${high.sampleSize} days with at least 7 hours of sleep and ${low.sampleSize} days with less than 7 hours. At least ${comparison.minimumDaysPerGroup} recorded days in each group are needed. No conclusion is drawn from these averages.`;
  }
  return `Average mood was ${high.averageMood}/10 across ${high.sampleSize} days with at least 7 hours of sleep, compared with ${low.averageMood}/10 across ${low.sampleSize} days with less than 7 hours. These are descriptive averages, not evidence that sleep caused a mood change or that the difference is statistically meaningful.`;
}

export function describeExerciseComparison(
  comparison: Omit<ExerciseMetricComparison, "summary">,
  metric: "mood" | "energy"
): string {
  const yes = comparison.exercise,
    no = comparison.nonExercise;
  if (comparison.status === "insufficient_data")
    return `Not enough data to compare ${metric} yet: ${yes.sampleSize} exercise days and ${no.sampleSize} non-exercise days with ${metric} recorded. At least 5 days in each group are needed. No conclusion is drawn from these averages.`;
  return `Average ${metric} was ${yes.average}/10 across ${yes.sampleSize} exercise days and ${no.average}/10 across ${no.sampleSize} non-exercise days. These are descriptive averages, not evidence that exercise caused a change or that the difference is statistically meaningful. Other factors may contribute.`;
}
