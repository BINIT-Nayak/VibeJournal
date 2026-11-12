import "server-only";
import { z } from "zod";
import type { WeeklyReflectionProvider } from "./provider";
import {
  weeklySummarySchema,
  weeklyReflectionSchema,
} from "../../features/weekly-reflection/schemas";
import { JournalAnalysisProviderError } from "../journal-analysis/provider";
import { WEEKLY_REFLECTION_PROMPT } from "./prompts";
import { InvalidJournalAnalysisError } from "../journal-analysis/validation";

const inputSchema = weeklySummarySchema;
const envelopeSchema = z.object({
  stop_reason: z.literal("end_turn"),
  content: z.array(z.object({ type: z.literal("text"), text: z.string().max(16000) })).length(1),
});

export function createAnthropicWeeklyProvider(
  config: { apiKey: string; model: string; timeoutMs: number },
  fetcher: typeof fetch = fetch
): WeeklyReflectionProvider {
  return {
    async reflect(input, options = {}) {
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
            system: WEEKLY_REFLECTION_PROMPT,
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
        let output: unknown;
        try {
          output = JSON.parse(envelope.data.content[0].text);
        } catch {
          throw new InvalidJournalAnalysisError();
        }
        const result = weeklyReflectionSchema.safeParse(output);
        if (!result.success) throw new InvalidJournalAnalysisError();
        return result.data;
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
