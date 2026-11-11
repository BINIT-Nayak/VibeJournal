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
  tagFrequency: Array<{ tag: string; entryCount: number }>;
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
  insights: AnalyticsInsight[];
};
