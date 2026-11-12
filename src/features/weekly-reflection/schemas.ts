import { z } from "zod";

const count = z.number().int().nonnegative();
const score = z.number().min(1).max(10).nullable();
export const weeklySummarySchema = z.strictObject({
  period: z.strictObject({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    timeZone: z.literal("UTC"),
  }),
  journalCount: count,
  recordedDays: count.max(7),
  averageMood: score,
  averageEnergy: score,
  days: z
    .array(
      z.strictObject({
        date: z.iso.date(),
        entries: count,
        averageMood: score,
        averageSleepHours: z.number().min(0).max(24).nullable(),
      })
    )
    .length(7),
  sleep: z.strictObject({
    averageHours: z.number().min(0).max(24).nullable(),
    recordedEntries: count,
    missingEntries: count,
  }),
  exercise: z.strictObject({
    exerciseDays: count.max(7),
    nonExerciseDays: count.max(7),
    unknownDays: count.max(7),
    conflictingDays: count.max(7),
  }),
  topThemes: z
    .array(
      z.strictObject({
        theme: z.string().trim().min(1).max(80),
        entries: count,
        days: count.max(7),
      })
    )
    .max(5),
});
export const weeklyReflectionSchema = z.strictObject({
  reflection: z.string().trim().min(1).max(1600),
  observations: z.array(z.string().trim().min(1).max(300)).max(3),
  reflectionPrompt: z.string().trim().min(1).max(500),
});
export type WeeklySummary = z.infer<typeof weeklySummarySchema>;
export type WeeklyReflection = z.infer<typeof weeklyReflectionSchema>;
export type WeeklyPreview = {
  summary: WeeklySummary;
  consent: boolean;
  eligible: boolean;
};
