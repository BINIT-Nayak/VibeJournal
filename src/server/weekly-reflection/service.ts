import "server-only";
import { z } from "zod";
import { openValue } from "../encryption/content";
import { enforceRateLimit } from "../rate-limit";
import { readAnalytics } from "../analytics/repository";
import { hasConsent, readAnalysisPage } from "./repository";
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
  await enforceRateLimit("ai-weekly", userId);
  await enforceRateLimit("ai-user", userId);
  const selected = provider ?? createAnthropicWeeklyProvider(getAIConfiguration());
  const result = await selected.reflect(preview.summary, { signal });
  const reflection = weeklyReflectionSchema.parse(result);
  if (!(await hasConsent(userId))) throw new WeeklyReflectionError("CONSENT_REQUIRED");
  return { summary: preview.summary, reflection };
}

async function readTopThemes(userId: string, start: Date, asOf: Date) {
  const counts = new Map<string, { entries: Set<string>; days: Set<string> }>();
  let after: string | undefined;
  let total = 0;
  for (;;) {
    const page = await readAnalysisPage(userId, start, asOf, after);
    total += page.length;
    if (total > 10000) throw new Error("Weekly theme processing limit reached.");
    for (const row of page) {
      if (+row.sourceUpdatedAt !== +row.journalEntry.updatedAt) continue;
      const parsed = z
        .object({ themes: z.array(z.string().max(80)).max(8) })
        .parse(
          await openValue(
            userId,
            "analysis",
            row.journalEntryId,
            row.privatePayload,
            row.sourceUpdatedAt.toISOString()
          )
        );
      for (const theme of parsed.themes) {
        const name = theme.trim().toLowerCase();
        if (!name) continue;
        const value = counts.get(name) ?? { entries: new Set<string>(), days: new Set<string>() };
        value.entries.add(row.journalEntryId);
        value.days.add(row.journalEntry.createdAt.toISOString().slice(0, 10));
        counts.set(name, value);
      }
    }
    if (page.length < 200) break;
    after = page[page.length - 1].id;
  }
  return [...counts]
    .filter(([, value]) => value.days.size >= 2)
    .map(([theme, value]) => ({ theme, entries: value.entries.size, days: value.days.size }))
    .sort((a, b) => b.entries - a.entries || a.theme.localeCompare(b.theme))
    .slice(0, 5);
}
