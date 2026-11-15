"use client";

import dynamic from "next/dynamic";
import { dateLabel } from "./chart-date";
import type { DashboardResponse } from "./types";
import styles from "./DashboardScreen.module.css";

const MoodTrendPlot = dynamic(
  () => import("./MoodTrendPlot").then((module) => module.MoodTrendPlot),
  {
    loading: () => <p role="status">Loading chart…</p>,
  }
);

export function MoodTrendChart({ days }: { days: DashboardResponse["moodTrend"] }) {
  const hasData = days.some((day) => day.averageMood !== null);
  return (
    <>
      {hasData ? (
        <div
          className={styles.chart}
          role="group"
          aria-label={`Daily average mood over the last ${days.length} days, from 1 to 10`}
        >
          <MoodTrendPlot days={days} />
        </div>
      ) : (
        <div className={styles.chartEmpty}>
          <span aria-hidden="true">◌</span>
          <strong>Your story takes shape one day at a time.</strong>
          <p>Record a mood to begin your {days.length}-day view.</p>
        </div>
      )}
      <div className={styles.chartNote}>
        <span>
          <i aria-hidden="true" />
          Daily average mood
        </span>
        <span>1 = very low · 10 = wonderful</span>
      </div>
      <details className={styles.chartDetails}>
        <summary>View mood values as a table</summary>
        <table>
          <caption>{days.length}-day mood history · UTC</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Mood</th>
              <th scope="col">Entries</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <th scope="row">{dateLabel(day.date)}</th>
                <td>{day.averageMood == null ? "Not recorded" : `${day.averageMood}/10`}</td>
                <td>{day.journalCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
