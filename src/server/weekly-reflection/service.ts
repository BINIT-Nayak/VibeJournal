import "server-only";
import { readAnalytics } from "../analytics/repository";
import { hasConsent, readTopThemes } from "./repository";
import { buildWeeklySummary } from "./summary";
import { createAnthropicWeeklyProvider } from "./anthropic";
import { getAIConfiguration } from "../journal-analysis/config";
import {
  weeklyReflectionSchema,
  type WeeklyPreview,
} from "../../features/weekly-reflection/schemas";
import type { WeeklyReflectionProvider } from "./provider";

export class WeeklyReflectionError extends Error {
  constructor(readonly code: "CONSENT_REQUIRED" | "INSUFFICIENT_DATA") {
    super(
      code === "CONSENT_REQUIRED"
        ? "Enable AI analysis in Settings before generating a weekly reflection."
        : "Record reflections on at least three days this week before generating a weekly reflection."
    );
  }
}
export async function getWeeklyPreview(userId: string): Promise<WeeklyPreview> {
  if (!userId) throw new Error("UNAUTHORIZED");
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
  const dates = Array.from({ length: 7 }, (_, index) =>
    new Date(+start + index * 86400000).toISOString().slice(0, 10)
  );
  const [aggregates, themes, consent] = await Promise.all([
    readAnalytics(userId, start, now),
    readTopThemes(userId, start, now),
    hasConsent(userId),
  ]);
  const summary = buildWeeklySummary(aggregates.daily, dates, themes);
  return { summary, consent, eligible: summary.recordedDays >= 3 };
}
export async function generateWeeklyReflection(
  userId: string,
  signal?: AbortSignal,
  provider?: WeeklyReflectionProvider
) {
  if (!userId) throw new Error("UNAUTHORIZED");
  if (!(await hasConsent(userId))) throw new WeeklyReflectionError("CONSENT_REQUIRED");
  const preview = await getWeeklyPreview(userId);
  if (!preview.eligible) throw new WeeklyReflectionError("INSUFFICIENT_DATA");
  if (!(await hasConsent(userId))) throw new WeeklyReflectionError("CONSENT_REQUIRED");
  const result = await (provider ?? createAnthropicWeeklyProvider(getAIConfiguration())).reflect(
    preview.summary,
    { signal }
  );
  const reflection = weeklyReflectionSchema.parse(result);
  if (!(await hasConsent(userId))) throw new WeeklyReflectionError("CONSENT_REQUIRED");
  return { summary: preview.summary, reflection };
}
