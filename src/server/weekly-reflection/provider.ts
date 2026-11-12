import "server-only";
import type { WeeklySummary, WeeklyReflection } from "../../features/weekly-reflection/schemas";
export interface WeeklyReflectionProvider {
  reflect(summary: WeeklySummary, options?: { signal?: AbortSignal }): Promise<WeeklyReflection>;
}
