import "server-only";
import type { ExerciseComparison, ExerciseMetricComparison } from "@/features/analytics/types";
import type { DailyAggregate } from "./data";
import { describeExerciseComparison } from "./insights";

function compare(
  exercise: number[],
  nonExercise: number[],
  metric: "mood" | "energy"
): ExerciseMetricComparison {
  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);
  const yes = mean(exercise),
    no = mean(nonExercise);
  const result: Omit<ExerciseMetricComparison, "summary"> = {
    status: exercise.length >= 5 && nonExercise.length >= 5 ? "available" : "insufficient_data",
    exercise: { sampleSize: exercise.length, average: round(yes) },
    nonExercise: { sampleSize: nonExercise.length, average: round(no) },
    difference: exercise.length >= 5 && nonExercise.length >= 5 ? round(yes! - no!) : null,
  };
  return { ...result, summary: describeExerciseComparison(result, metric) };
}

/** Classify only days with an unambiguous recorded exercise status. */
export function calculateExerciseComparison(days: DailyAggregate[]): ExerciseComparison {
  const moodYes: number[] = [],
    moodNo: number[] = [],
    energyYes: number[] = [],
    energyNo: number[] = [];
  let missing = 0,
    conflicting = 0;
  for (const day of days) {
    if (!day.count) continue;
    if (!day.exerciseYes && !day.exerciseNo) {
      missing++;
      continue;
    }
    if (day.exerciseYes && day.exerciseNo) {
      conflicting++;
      continue;
    }
    (day.exerciseYes ? moodYes : moodNo).push(day.moodSum / day.count);
    if (day.energyCount > 0 && day.energySum !== null)
      (day.exerciseYes ? energyYes : energyNo).push(day.energySum / day.energyCount);
  }
  return {
    sampleUnit: "day",
    minimumDaysPerGroup: 5,
    excludedDaysWithoutExercise: missing,
    excludedDaysWithConflictingExercise: conflicting,
    mood: compare(moodYes, moodNo, "mood"),
    energy: compare(energyYes, energyNo, "energy"),
  };
}
