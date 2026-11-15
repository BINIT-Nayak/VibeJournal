import { describe, expect, it } from "vitest";
import { buildMoodTrend } from "@/server/analytics/mood-trend";
import { calculateStatistics } from "@/server/analytics/statistics";
import { calculateSleepComparison } from "@/server/analytics/sleep-comparison";
import { describeSleepComparison } from "@/server/analytics/insights";
import type { DailyAggregate } from "@/server/analytics/data";
const day = (values: Partial<DailyAggregate> = {}): DailyAggregate => ({
  date: "2026-01-01",
  count: 1,
  moodSum: 6,
  energyCount: 0,
  energySum: null,
  sleepCount: 0,
  sleepSum: null,
  sleepMin: null,
  sleepMax: null,
  exerciseYes: 0,
  exerciseNo: 0,
  yesMoodSum: null,
  noMoodSum: null,
  ...values,
});
describe("analytics consumers can distinguish missing observations from low scores", () => {
  it.each([7, 30, 90])("returns %i dated gaps for an empty range", (length) => {
    const dates = Array.from({ length }, (_, i) =>
      new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
    );
    const trend = buildMoodTrend([], dates);
    expect(trend.map((point) => point.date)).toEqual(dates);
    expect(
      trend.every(
        (point) =>
          point.averageMood === null && point.averageEnergy === null && point.journalCount === 0
      )
    ).toBe(true);
  });
  it("keeps a missing day between recorded days unknown", () => {
    const trend = buildMoodTrend(
      [day(), day({ date: "2026-01-03", count: 2, moodSum: 16 })],
      ["2026-01-01", "2026-01-02", "2026-01-03"]
    );
    expect(trend.map((point) => point.averageMood)).toEqual([6, null, 8]);
  });
  it("weights overall mood by journal observations and excludes unrecorded energy", () => {
    const stats = calculateStatistics(
      [
        day({ count: 3, moodSum: 24, energyCount: 1, energySum: 4 }),
        day({ date: "2026-01-02", moodSum: 4 }),
      ],
      [],
      []
    );
    expect(stats.mood.average).toBe(7);
    expect(stats.energy).toEqual({ average: 4, recordedCount: 1, missingCount: 3 });
  });
  it("does not interpret an empty history as zero mood or sleep", () => {
    const stats = calculateStatistics([], [], []);
    expect(stats.mood.average).toBeNull();
    expect(stats.sleep.average).toBeNull();
    expect(stats.sleep.minHours).toBeNull();
  });
});
describe("conservative sleep insights", () => {
  it("counts days rather than multiple entries as independent evidence", () => {
    const result = calculateSleepComparison([
      day({ count: 10, moodSum: 80, sleepCount: 10, sleepSum: 80 }),
      day({ sleepCount: 1, sleepSum: 6.999 }),
    ]);
    expect(result.atLeast7Hours.sampleSize).toBe(1);
    expect(result.lessThan7Hours.sampleSize).toBe(1);
    expect(result.status).toBe("insufficient_data");
    expect(result.moodDifference).toBeNull();
    expect(describeSleepComparison(result)).toContain("No conclusion is drawn");
  });
  it("reports adequate sample sizes with an explicit non-causal qualification", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      day({
        date: `2026-01-${String(i + 1).padStart(2, "0")}`,
        sleepCount: 1,
        sleepSum: i < 5 ? 7 : 6,
        moodSum: i < 5 ? 8 : 6,
      })
    );
    const result = calculateSleepComparison(rows);
    expect(result.status).toBe("available");
    expect(result.moodDifference).toBe(2);
    expect(result.atLeast7Hours.sampleSize).toBe(5);
    expect(result.lessThan7Hours.sampleSize).toBe(5);
    expect(describeSleepComparison(result)).toContain("not evidence that sleep caused");
  });
});
