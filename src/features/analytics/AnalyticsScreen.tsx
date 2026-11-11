"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsRanges, type AnalyticsResponse } from "./types";
import styles from "@/features/dashboard/DashboardScreen.module.css";

export function AnalyticsScreen({ userId }: { userId: string }) {
  const [days, setDays] = useState("30");
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["analytics", userId, days],
    queryFn: async ({ signal }): Promise<AnalyticsResponse> => {
      const response = await fetch(`/api/analytics?days=${days}`, { signal, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? "Could not load analytics.");
      return result;
    },
    retry: false,
    staleTime: 0,
  });
  return (
    <section className={styles.dashboard}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>YOUR REFLECTIONS, IN CONTEXT</p>
          <h1>Patterns over time</h1>
          <p>Statistics from your recorded entries. Missing values stay unknown.</p>
        </div>
        <label>
          Period{" "}
          <select value={days} onChange={(event) => setDays(event.target.value)}>
            {analyticsRanges.map((value) => (
              <option key={value} value={value}>
                Last {value} days
              </option>
            ))}
          </select>
        </label>
      </header>
      {isPending ? (
        <p role="status">Loading analytics…</p>
      ) : error ? (
        <div role="alert">
          <p>{error.message}</p>
          <button disabled={isFetching} onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : (
        data && (
          <>
            <p>
              {data.period.startDate} – {data.period.endDate} · UTC · {data.statistics.journalCount}{" "}
              reflections
            </p>
            <dl className={styles.stats}>
              {[
                ["Average mood", data.statistics.mood.average, "/10"],
                ["Average energy", data.statistics.energy.average, "/10"],
                ["Average sleep", data.statistics.sleep.average, " hours"],
                ["Exercise recorded", data.statistics.exercise.yesCount, " yes"],
              ].map(([label, value, suffix]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {value == null ? (
                      <span className={styles.noValue}>Not recorded</span>
                    ) : (
                      `${value}${suffix}`
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <section className={styles.panel}>
              <h2>Your reflections, summarized</h2>
              {data.insights.map((insight) => (
                <p key={insight.id}>{insight.text}</p>
              ))}
            </section>
            <section className={styles.panel}>
              <h2>Mood and energy trend</h2>
              <div className={styles.chartDetails}>
                <table>
                  <caption>Daily recorded averages · UTC</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Mood</th>
                      <th scope="col">Energy</th>
                      <th scope="col">Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.statistics.moodTrend.map((day) => (
                      <tr key={day.date}>
                        <th scope="row">{day.date}</th>
                        <td>{day.averageMood ?? "—"}</td>
                        <td>{day.averageEnergy ?? "—"}</td>
                        <td>{day.journalCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className={styles.panel}>
              <h2>Sleep and exercise</h2>
              <p>
                Sleep recorded: {data.statistics.sleep.recordedCount} · Not recorded:{" "}
                {data.statistics.sleep.missingCount}
              </p>
              <p>
                Sleep range:{" "}
                {data.statistics.sleep.minHours == null
                  ? "Not recorded"
                  : `${data.statistics.sleep.minHours}–${data.statistics.sleep.maxHours} hours`}
              </p>
              <p>
                Exercise: {data.statistics.exercise.yesCount} yes ·{" "}
                {data.statistics.exercise.noCount} no · {data.statistics.exercise.missingCount} not
                recorded
              </p>
            </section>
            <section className={styles.panel}>
              <h2>Tag frequency</h2>
              {data.statistics.tagFrequency.length ? (
                <ul>
                  {data.statistics.tagFrequency.map((item) => (
                    <li key={item.tag}>
                      {item.tag}: {item.entryCount} reflections
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No tags recorded in this period.</p>
              )}
            </section>
            <section className={styles.panel}>
              <h2>Associations with mood</h2>
              <p>
                Requires at least 10 paired reflections across 5 days. Associations do not establish
                cause and effect.
              </p>
              {data.correlations.map((item) => (
                <p key={item.metric}>
                  {item.metric}:{" "}
                  {item.coefficient == null
                    ? item.status === "no_variation"
                      ? "Not enough variation to calculate"
                      : "Not enough data yet"
                    : `r = ${item.coefficient}`}{" "}
                  · {item.sampleCount} paired entries across {item.distinctDays} days
                </p>
              ))}
            </section>
          </>
        )
      )}
    </section>
  );
}
