import "server-only";
import type { JournalAnalysis } from "../../features/journal-analysis/schemas";

export type JournalAnalysisInput = { title?: string | null; content: string };
export type AnalysisOptions = { signal?: AbortSignal };

export interface JournalAnalysisProvider {
  analyze(input: JournalAnalysisInput, options?: AnalysisOptions): Promise<JournalAnalysis>;
}

export class JournalAnalysisProviderError extends Error {
  constructor(
    readonly code:
      | "AI_CONSENT_REQUIRED"
      | "AI_NOT_CONFIGURED"
      | "AI_UNAVAILABLE"
      | "AI_TIMEOUT"
      | "AI_CANCELLED"
      | "INVALID_ANALYSIS_INPUT"
  ) {
    super(
      {
        AI_CONSENT_REQUIRED: "AI analysis requires consent and an owned journal entry.",
        AI_NOT_CONFIGURED: "Journal analysis is not configured.",
        AI_UNAVAILABLE: "Journal analysis is temporarily unavailable.",
        AI_TIMEOUT: "Journal analysis took too long. Please try again.",
        AI_CANCELLED: "Journal analysis was cancelled.",
        INVALID_ANALYSIS_INPUT: "The journal analysis input was invalid.",
      }[code]
    );
    this.name = "JournalAnalysisProviderError";
  }
}
