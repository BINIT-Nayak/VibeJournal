import "server-only";
import type { JournalAnalysisView } from "../../features/journal-analysis/types";
import { findStoredAnalysis } from "./repository";
import { validateJournalAnalysis } from "./validation";

/** Read-only: viewing a journal never triggers a provider request. */
export async function getJournalAnalysis(
  userId: string,
  journalEntryId: string,
  entryUpdatedAt: string
): Promise<JournalAnalysisView> {
  if (!userId) return { status: "unavailable" };
  try {
    const row = await findStoredAnalysis(userId, journalEntryId);
    if (!row) return { status: "missing" };
    if (
      row.sourceUpdatedAt.toISOString() !== entryUpdatedAt ||
      row.sourceUpdatedAt.getTime() !== row.journalEntry.updatedAt.getTime()
    )
      return { status: "stale" };
    const {
      primaryEmotion,
      emotions,
      sentimentScore,
      themes,
      estimatedEnergy,
      reflectionPrompt,
      confidence,
    } = row;
    const analysis = validateJournalAnalysis({
      primaryEmotion,
      emotions,
      sentimentScore,
      themes,
      estimatedEnergy,
      reflectionPrompt,
      confidence,
    });
    return {
      status: "available",
      analysis: {
        primaryEmotion: analysis.primaryEmotion,
        emotions: analysis.emotions,
        themes: analysis.themes,
        reflectionPrompt: analysis.reflectionPrompt,
      },
    };
  } catch {
    // Optional AI content must not prevent the owner reading their journal.
    return { status: "unavailable" };
  }
}
