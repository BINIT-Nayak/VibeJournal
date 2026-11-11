import { z } from "zod";

const score = z.number().int("Use a whole-number score.").min(1).max(10);
const tags = z
  .array(z.string().trim().min(1, "Tags cannot be blank.").max(40))
  .max(20)
  .transform((values) => [...new Set(values.map((value) => value.toLowerCase()))]);

// Canonical fields shared by the browser and API. Omitted optional fields are
// preserved on edit; null explicitly clears a nullable value.
export const journalEntrySchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  content: z.string().trim().min(1, "Write a note before saving.").max(20000),
  moodScore: score,
  energyScore: score.nullable().optional(),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
  exercised: z.boolean().nullable().optional(),
  socialScore: score.nullable().optional(),
  tags: tags.optional(),
  // Existing journal UI metadata remains supported alongside the core fields.
  mood: z
    .enum(["joyful", "calm", "anxious", "sad", "angry", "tired", "hopeful", "neutral"])
    .optional(),
  stress: score.nullable().optional(),
  exerciseMinutes: z.number().int().min(0).max(240).nullable().optional(),
  voiceNote: z.string().trim().max(20000).nullable().optional(),
  photoNames: z.array(z.string().trim().min(1).max(255)).max(20).optional(),
});

export const journalCreateSchema = journalEntrySchema;
export const journalUpdateSchema = journalEntrySchema
  .partial()
  .extend({ archived: z.boolean().optional() })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "Provide at least one field to update."
  );

// Compatibility for older clients. Canonical values take precedence when both
// names are supplied; all values still pass the same validators.
export function normalizeJournalInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = { ...input } as Record<string, unknown>;
  for (const [legacy, canonical] of Object.entries({
    note: "content",
    valence: "moodScore",
    energy: "energyScore",
    socialLevel: "socialScore",
  })) {
    if (!(canonical in value) && legacy in value) value[canonical] = value[legacy];
  }
  if (
    !("exercised" in value) &&
    "exerciseMinutes" in value &&
    (typeof value.exerciseMinutes === "number" || value.exerciseMinutes === null)
  ) {
    value.exercised = value.exerciseMinutes === null ? null : (value.exerciseMinutes as number) > 0;
  }
  return value;
}

export type JournalCreateInput = z.infer<typeof journalCreateSchema>;
export type JournalUpdateInput = z.infer<typeof journalUpdateSchema>;
