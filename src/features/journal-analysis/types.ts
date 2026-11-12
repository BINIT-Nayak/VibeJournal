import type { JournalAnalysis } from "./schemas";

export type JournalAnalysisView =
  | {
      status: "available";
      analysis: Pick<
        JournalAnalysis,
        "primaryEmotion" | "emotions" | "themes" | "reflectionPrompt"
      >;
    }
  | { status: "missing" | "stale" | "unavailable" };
