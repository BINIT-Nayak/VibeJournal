import { z } from "zod";
import { musicPreferencesSchema } from "./preferences";

export const musicIntentSchema = z.enum(["match", "uplift", "calm", "focus"]);
export const musicEmotionSchema = z.enum([
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
export const musicTimeOfDaySchema = z.enum(["morning", "afternoon", "evening", "night"]);
export const musicContextSchema = z.strictObject({
  /** User-reported mood, 1 (low) to 10 (high). */
  mood: z.number().int().min(1).max(10),
  /** User-reported energy, 1 (low) to 10 (high). */
  energy: z.number().int().min(1).max(10),
  /** Null explicitly means no emotion label is known; AI is not required. */
  primaryEmotion: musicEmotionSchema.nullable(),
  intent: musicIntentSchema,
  timeOfDay: musicTimeOfDaySchema,
});

const unitRange = z
  .strictObject({
    min: z.number().min(0).max(1),
    target: z.number().min(0).max(1),
    max: z.number().min(0).max(1),
  })
  .refine((value) => value.min <= value.target && value.target <= value.max);
const tempoRange = z
  .strictObject({
    min: z.number().min(40).max(200),
    target: z.number().min(40).max(200),
    max: z.number().min(40).max(200),
  })
  .refine((value) => value.min <= value.target && value.target <= value.max);

export const musicCriteriaSchema = z.strictObject({
  constraints: musicPreferencesSchema,
  intent: musicIntentSchema,
  timeOfDay: musicTimeOfDaySchema,
  /** Perceived musical positivity, not an estimate of the user's mood. */
  positivity: unitRange,
  /** Perceived musical intensity. */
  intensity: unitRange,
  tempoBpm: tempoRange,
  vocals: z.enum(["any", "prefer_instrumental"]),
  descriptors: z
    .array(
      z.enum([
        "warm",
        "gentle",
        "reflective",
        "bright",
        "expressive",
        "steady",
        "spacious",
        "soft",
        "minimal",
        "low_distraction",
      ])
    )
    .min(1)
    .max(5),
  explanation: z.string().min(1).max(500),
});
export type MusicTimeOfDay = z.infer<typeof musicTimeOfDaySchema>;
export type MusicContext = z.infer<typeof musicContextSchema>;
export type MusicIntent = z.infer<typeof musicIntentSchema>;
export type MusicEmotion = z.infer<typeof musicEmotionSchema>;
export type MusicCriteria = z.infer<typeof musicCriteriaSchema>;
