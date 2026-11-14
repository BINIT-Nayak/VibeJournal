import "server-only";
import { openJournal, sealValue } from "../encryption/content";
import { RateLimitError } from "../rate-limit";
import { analyzeJournal } from "./service";
import type { JournalAnalysisProvider } from "./provider";
import { validateJournalAnalysis } from "./validation";
import * as repository from "./repository";

export type AnalysisOutcome = "saved" | "skipped" | "failed" | "rate_limited";

/** Best effort, after the journal transaction commits. Never rejects on AI/storage failure. */
export async function analyzeCreatedEntry(
  userId: string,
  journalEntryId: string,
  provider?: JournalAnalysisProvider
): Promise<AnalysisOutcome> {
  try {
    return await analyzeAndStoreEntry(userId, journalEntryId, provider);
  } catch (error) {
    if (error instanceof RateLimitError) return "rate_limited";
    return "failed";
  }
}

export async function analyzeAndStoreEntry(
  userId: string,
  journalEntryId: string,
  provider?: JournalAnalysisProvider
): Promise<AnalysisOutcome> {
  const stored = await repository.findEligibleEntry(userId, journalEntryId);
  if (!stored) return "skipped";
  const entry = await openJournal(userId, stored);
  const result = await analyzeJournal(
    { title: entry.title, content: entry.content },
    { userId, journalEntryId },
    provider
  );
  const saved = await repository.persistAnalysis(
    userId,
    entry.id,
    entry.updatedAt,
    validateJournalAnalysis(result),
    await sealValue(
      userId,
      "analysis",
      entry.id,
      { themes: result.themes, reflectionPrompt: result.reflectionPrompt },
      entry.updatedAt.toISOString()
    )
  );
  return saved ? "saved" : "skipped";
}
