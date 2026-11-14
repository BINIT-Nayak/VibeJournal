import "server-only";
import { openJournal } from "../encryption/content";
import { enforceRateLimit } from "../rate-limit";
import { getAIConfiguration } from "./config";
import { createAnthropicProvider } from "./anthropic";
import {
  JournalAnalysisProviderError,
  type JournalAnalysisProvider,
  type JournalAnalysisInput,
  type AnalysisOptions,
} from "./provider";
import { findEligibleEntry } from "./repository";
import { validateJournalAnalysis } from "./validation";

export function createJournalAnalysisProvider(): JournalAnalysisProvider {
  return createAnthropicProvider(getAIConfiguration());
}

/** Call only after the caller has checked consent and loaded an owned entry. */
export async function analyzeJournal(
  input: JournalAnalysisInput,
  options: AnalysisOptions & { userId: string; journalEntryId: string },
  provider?: JournalAnalysisProvider
) {
  // Reload consent and ownership immediately before resolving/calling any provider.
  // The caller's text must match the owned source version.
  const stored = await findEligibleEntry(options.userId, options.journalEntryId);
  const entry = stored ? await openJournal(options.userId, stored) : null;
  if (!entry || entry.content !== input.content || entry.title !== (input.title ?? null))
    throw new JournalAnalysisProviderError("AI_CONSENT_REQUIRED");
  await enforceRateLimit("ai-user", options.userId);
  const selected = provider ?? createJournalAnalysisProvider();
  return validateJournalAnalysis(
    await selected.analyze(
      { title: entry.title, content: entry.content },
      { signal: options.signal }
    )
  );
}
