export const analyticsRanges = [7, 30, 90] as const;
export type MoodTrendPoint = {
  /** UTC calendar date; usable directly as a chart's x-axis key. */
  date: string;
  /** Mean of entries that day, or null when no mood was recorded. */
  averageMood: number | null;
  averageEnergy: number | null;
  journalCount: number;
};

export type MetricSummary = { average: number | null; recordedCount: number; missingCount: number };
export type AnalyticsStatistics = {
  journalCount: number;
  mood: MetricSummary;
  energy: MetricSummary;
  sleep: MetricSummary & { minHours: number | null; maxHours: number | null };
  exercise: {
    yesCount: number;
    noCount: number;
    missingCount: number;
    averageMoodWhenExercised: number | null;
    averageMoodWhenNotExercised: number | null;
  };
  moodTrend: MoodTrendPoint[];
  tagCriteria: { minimumObservations: 5; minimumDays: 5; limit: 20 };
  tagFrequency: Array<{
    tag: string;
    entryCount: number;
    distinctDays: number;
    averageMood: number;
  }>;
};
export type AnalyticsCorrelation = {
  metric: "energy" | "sleep" | "exercise";
  coefficient: number | null;
  sampleCount: number;
  distinctDays: number;
  status: "available" | "insufficient_data" | "no_variation";
};
export type AnalyticsInsight = {
  id: string;
  text: string;
  kind: "summary" | "association" | "empty";
};
export type AnalyticsResponse = {
  period: { startDate: string; endDate: string; days: number; timeZone: "UTC"; asOf: string };
  statistics: AnalyticsStatistics;
  correlations: AnalyticsCorrelation[];
  sleepComparison: SleepMoodComparison;
  exerciseComparison: ExerciseComparison;
  insights: AnalyticsInsight[];
};

export type SleepMoodComparison = {
  thresholdHours: 7;
  minimumDaysPerGroup: 5;
  sampleUnit: "day";
  status: "insufficient_data" | "available";
  atLeast7Hours: { sampleSize: number; averageMood: number | null };
  lessThan7Hours: { sampleSize: number; averageMood: number | null };
  excludedDaysWithoutSleep: number;
  /** At-least-7-hours mean minus less-than-7-hours mean; null for insufficient data. */
  moodDifference: number | null;
  summary: string;
};

export type ExerciseMetricComparison = {
  status: "insufficient_data" | "available";
  exercise: { sampleSize: number; average: number | null };
  nonExercise: { sampleSize: number; average: number | null };
  /** Exercise minus non-exercise; null unless both groups meet the minimum. */
  difference: number | null;
  summary: string;
};
export type ExerciseComparison = {
  sampleUnit: "day";
  minimumDaysPerGroup: 5;
  excludedDaysWithoutExercise: number;
  excludedDaysWithConflictingExercise: number;
  mood: ExerciseMetricComparison;
  energy: ExerciseMetricComparison;
};
