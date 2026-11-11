import "server-only";

export type DailyAggregate = {
  date: string;
  count: number;
  moodSum: number;
  energySum: number | null;
  energyCount: number;
  sleepSum: number | null;
  sleepCount: number;
  sleepMin: number | null;
  sleepMax: number | null;
  exerciseYes: number;
  exerciseNo: number;
  yesMoodSum: number | null;
  noMoodSum: number | null;
};
export type CorrelationAggregate = {
  metric: "energy" | "sleep" | "exercise";
  n: number;
  days: number;
  x: number | null;
  y: number | null;
  xx: number | null;
  yy: number | null;
  xy: number | null;
};
export type TagAggregate = {
  tag: string;
  entryCount: number;
  distinctDays: number;
  moodSum: number;
};
