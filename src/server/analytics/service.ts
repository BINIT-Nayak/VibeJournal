import "server-only";
import { z } from "zod";
import type { ClientUser } from "@/features/auth/types";
import type { AnalyticsResponse } from "@/features/analytics/types";
import { cachedAnalytics } from "./cache";
import { readAnalytics } from "./repository";
import { calculateStatistics } from "./statistics";
import { calculateCorrelations } from "./correlations";
import { calculateExerciseComparison } from "./exercise-comparison";
import { calculateSleepComparison } from "./sleep-comparison";
import { generateInsights, describeSleepComparison } from "./insights";

const querySchema = z.object({
  days: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(90))
    .default(30),
});
export async function getAnalytics(
  user: Pick<ClientUser, "id">,
  query: unknown
): Promise<AnalyticsResponse> {
  if (!user.id) throw new Error("UNAUTHORIZED");
  const { days } = querySchema.parse(query);
  const asOf = new Date();
  const start = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() - days + 1)
  );
  const dates = Array.from({ length: days }, (_, index) =>
    new Date(+start + index * 86400000).toISOString().slice(0, 10)
  );
  return cachedAnalytics(user.id, dates[0], dates[days - 1], async () => {
    const aggregates = await readAnalytics(user.id, start, asOf);
    const statistics = calculateStatistics(aggregates.daily, aggregates.tags, dates);
    const correlations = calculateCorrelations(aggregates.pairs);
    const sleepComparison = calculateSleepComparison(aggregates.daily);
    return {
      period: {
        startDate: dates[0],
        endDate: dates[days - 1],
        days,
        timeZone: "UTC",
        asOf: asOf.toISOString(),
      },
      statistics,
      correlations,
      sleepComparison: { ...sleepComparison, summary: describeSleepComparison(sleepComparison) },
      exerciseComparison: calculateExerciseComparison(aggregates.daily),
      insights: generateInsights(statistics, correlations),
    };
  });
}
