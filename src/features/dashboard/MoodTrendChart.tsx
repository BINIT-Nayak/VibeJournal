"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardResponse } from "./types";
import styles from "./DashboardScreen.module.css";

function dateLabel(value: string, weekday = false) {
  return new Intl.DateTimeFormat(
    "en",
    weekday
      ? { weekday: "short", timeZone: "UTC" }
      : { month: "short", day: "numeric", timeZone: "UTC" }
  ).format(new Date(`${value}T12:00:00Z`));
}

export function MoodTrendChart({ days }: { days: DashboardResponse["moodTrend"] }) {
  const hasData = days.some((day) => day.averageMood !== null);
  return (
    <>
      {hasData ? (
        <div
          className={styles.chart}
          role="group"
          aria-label="Daily average mood over the last seven days, from 1 to 10"
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={days}
              accessibilityLayer
              margin={{ top: 18, right: 18, bottom: 8, left: -22 }}
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => dateLabel(value, true)}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickMargin={12}
              />
              <YAxis
                domain={[1, 10]}
                ticks={[1, 4, 7, 10]}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(value) => dateLabel(String(value))}
                formatter={(value) => [`${value}/10`, "Average mood"]}
                contentStyle={{
                  background: "var(--surface-strong)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  color: "var(--ink)",
                }}
              />
              <Line
                type="linear"
                dataKey="averageMood"
                name="Average mood"
                stroke="var(--accent-strong)"
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--surface-strong)", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={styles.chartEmpty}>
          <span aria-hidden="true">◌</span>
          <strong>Your story takes shape one day at a time.</strong>
          <p>Record a mood to begin your seven-day view.</p>
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
          <caption>Seven-day mood history</caption>
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
