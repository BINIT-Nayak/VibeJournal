import "server-only";
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
  const entry = await repository.findEligibleEntry(userId, journalEntryId);
  if (!entry) return "skipped";
  const result = await analyzeJournal(
    { title: entry.title, content: entry.content },
    { userId, journalEntryId },
    provider
  );
  const saved = await repository.persistAnalysis(
    userId,
    entry.id,
    entry.updatedAt,
    validateJournalAnalysis(result)
  );
  return saved ? "saved" : "skipped";
}
