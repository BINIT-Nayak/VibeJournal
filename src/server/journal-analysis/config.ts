import "server-only";
import { z } from "zod";
import { JournalAnalysisProviderError } from "./provider";

const configSchema = z.object({
  AI_JOURNAL_PROVIDER: z.literal("anthropic"),
  ANTHROPIC_API_KEY: z.string().trim().min(1),
  AI_JOURNAL_MODEL: z.string().trim().min(1).max(200),
  AI_JOURNAL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
});

/** Resolve configuration only when analysis is requested, never at build time. */
export function getAIConfiguration() {
  const config = configSchema.safeParse({
    AI_JOURNAL_PROVIDER: process.env.AI_JOURNAL_PROVIDER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    AI_JOURNAL_MODEL: process.env.AI_JOURNAL_MODEL,
    AI_JOURNAL_TIMEOUT_MS: process.env.AI_JOURNAL_TIMEOUT_MS,
  });
  if (!config.success) throw new JournalAnalysisProviderError("AI_NOT_CONFIGURED");
  return {
    apiKey: config.data.ANTHROPIC_API_KEY,
    model: config.data.AI_JOURNAL_MODEL,
    timeoutMs: config.data.AI_JOURNAL_TIMEOUT_MS,
  };
}
