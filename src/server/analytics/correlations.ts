import "server-only";
import type { AnalyticsCorrelation } from "@/features/analytics/types";
import type { CorrelationAggregate } from "./data";

// Pearson r; for binary exercise this is the point-biserial correlation.
// Require coverage across days so repeated entries on one day are not a pattern.
export function calculateCorrelations(rows: CorrelationAggregate[]): AnalyticsCorrelation[] {
  return (["energy", "sleep", "exercise"] as const).map((metric) => {
    const row = rows.find((item) => item.metric === metric);
    const base = { metric, sampleCount: row?.n ?? 0, distinctDays: row?.days ?? 0 };
    if (!row || row.n < 10 || row.days < 5)
      return { ...base, coefficient: null, status: "insufficient_data" };
    const varianceX = row.n * (row.xx ?? 0) - (row.x ?? 0) ** 2;
    const varianceY = row.n * (row.yy ?? 0) - (row.y ?? 0) ** 2;
    if (varianceX <= 1e-10 || varianceY <= 1e-10)
      return { ...base, coefficient: null, status: "no_variation" };
    const r =
      (row.n * (row.xy ?? 0) - (row.x ?? 0) * (row.y ?? 0)) / Math.sqrt(varianceX * varianceY);
    return {
      ...base,
      coefficient: Math.round(Math.max(-1, Math.min(1, r)) * 1000) / 1000,
      status: "available",
    };
  });
}
