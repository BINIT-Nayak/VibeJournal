import "server-only";
import type {
  AnalyticsStatistics,
  AnalyticsCorrelation,
  AnalyticsInsight,
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
      text: `“${stats.tagFrequency[0].tag}” appeared in ${stats.tagFrequency[0].entryCount} reflections, making it a most-used tag in this period.`,
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
