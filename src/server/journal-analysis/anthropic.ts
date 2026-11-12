import "server-only";
import { z } from "zod";
import type { JournalAnalysisProvider } from "./provider";
import { JournalAnalysisProviderError } from "./provider";
import { JOURNAL_ANALYSIS_PROMPT } from "./prompts";
import { InvalidJournalAnalysisError, validateJournalAnalysis } from "./validation";

const inputSchema = z.strictObject({
  title: z.string().trim().max(200).nullable().optional(),
  content: z.string().trim().min(1).max(20000),
});
const envelopeSchema = z.object({
  stop_reason: z.literal("end_turn"),
  content: z.array(z.object({ type: z.literal("text"), text: z.string().max(16000) })).length(1),
});

export function createAnthropicProvider(
  config: { apiKey: string; model: string; timeoutMs: number },
  fetcher: typeof fetch = fetch
): JournalAnalysisProvider {
  return {
    async analyze(input, options = {}) {
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success) throw new JournalAnalysisProviderError("INVALID_ANALYSIS_INPUT");
      if (options.signal?.aborted) throw new JournalAnalysisProviderError("AI_CANCELLED");
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), config.timeoutMs);
      const signal = options.signal
        ? AbortSignal.any([options.signal, timeout.signal])
        : timeout.signal;
      try {
        const response = await fetcher("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 1500,
            system: JOURNAL_ANALYSIS_PROMPT,
            messages: [{ role: "user", content: JSON.stringify(parsed.data) }],
          }),
          signal,
          cache: "no-store",
          redirect: "error",
        });
        // Never expose or log provider error bodies, request headers or journal text.
        if (!response.ok) throw new JournalAnalysisProviderError("AI_UNAVAILABLE");
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new InvalidJournalAnalysisError();
        }
        if (signal.aborted) throw new JournalAnalysisProviderError("AI_CANCELLED");
        const envelope = envelopeSchema.safeParse(payload);
        if (!envelope.success) throw new InvalidJournalAnalysisError();
        return validateJournalAnalysis(envelope.data.content[0].text);
      } catch (error) {
        if (options.signal?.aborted) throw new JournalAnalysisProviderError("AI_CANCELLED");
        if (timeout.signal.aborted) throw new JournalAnalysisProviderError("AI_TIMEOUT");
        if (
          error instanceof InvalidJournalAnalysisError ||
          error instanceof JournalAnalysisProviderError
        )
          throw error;
        throw new JournalAnalysisProviderError("AI_UNAVAILABLE");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
