import { z } from "zod";

// Stable descriptive labels, not diagnostic categories.
export const journalEmotionSchema = z.enum([
  "joyful",
  "calm",
  "anxious",
  "sad",
  "angry",
  "tired",
  "hopeful",
  "neutral",
  "grateful",
  "lonely",
  "overwhelmed",
  "frustrated",
  "excited",
  "content",
]);

export const journalAnalysisSchema = z
  .strictObject({
    primaryEmotion: journalEmotionSchema,
    emotions: z.array(journalEmotionSchema).min(1).max(5),
    /** -1 = negative, 0 = neutral, 1 = positive. */
    sentimentScore: z.number().min(-1).max(1),
    themes: z.array(z.string().trim().min(1).max(80)).max(8),
    /** An estimate, not the user's self-reported energy score. */
    estimatedEnergy: z.number().int().min(1).max(10),
    reflectionPrompt: z.string().trim().min(1).max(500),
    /** Model-reported uncertainty; not a calibrated probability. */
    confidence: z.number().min(0).max(1),
  })
  .superRefine((value, context) => {
    if (!value.emotions.includes(value.primaryEmotion)) {
      context.addIssue({
        code: "custom",
        path: ["emotions"],
        message: "Emotions must include the primary emotion.",
      });
    }
    if (new Set(value.emotions).size !== value.emotions.length) {
      context.addIssue({ code: "custom", path: ["emotions"], message: "Emotions must be unique." });
    }
    if (new Set(value.themes.map((theme) => theme.toLowerCase())).size !== value.themes.length) {
      context.addIssue({ code: "custom", path: ["themes"], message: "Themes must be unique." });
    }
  })
  .brand<"ValidatedJournalAnalysis">();

export type JournalEmotion = z.infer<typeof journalEmotionSchema>;
export type JournalAnalysis = z.infer<typeof journalAnalysisSchema>;
