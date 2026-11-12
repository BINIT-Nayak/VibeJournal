import "server-only";
import {
  journalAnalysisSchema,
  type JournalAnalysis,
} from "../../features/journal-analysis/schemas";

// Keep failures generic: model responses can contain private journal text.
export class InvalidJournalAnalysisError extends Error {
  readonly code = "INVALID_JOURNAL_ANALYSIS";

  constructor() {
    super("The journal analysis response was invalid.");
    this.name = "InvalidJournalAnalysisError";
  }
}

/** The only boundary for provider output, whether parsed JSON or raw JSON text. */
export function validateJournalAnalysis(output: unknown): JournalAnalysis {
  let candidate: unknown = output;
  if (typeof output === "string") {
    // Bound parsing work. Do not extract JSON from prose or Markdown fences.
    if (output.length > 16000) throw new InvalidJournalAnalysisError();
    try {
      candidate = JSON.parse(output) as unknown;
    } catch {
      throw new InvalidJournalAnalysisError();
    }
  }
  const result = journalAnalysisSchema.safeParse(candidate);
  if (!result.success) throw new InvalidJournalAnalysisError();
  return result.data;
}
