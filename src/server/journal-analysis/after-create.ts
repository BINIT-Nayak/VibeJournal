import "server-only";
import { analyzeJournal } from "./service";
import type { JournalAnalysisProvider } from "./provider";
import { validateJournalAnalysis } from "./validation";
import * as repository from "./repository";

export type AnalysisOutcome = "saved" | "skipped" | "failed";

/** Best effort, after the journal transaction commits. Never rejects on AI/storage failure. */
export async function analyzeCreatedEntry(
  userId: string,
  journalEntryId: string,
  provider?: JournalAnalysisProvider
): Promise<AnalysisOutcome> {
  try {
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
  } catch {
    // Do not log errors that may contain journal text, credentials or model output.
    return "failed";
  }
}
