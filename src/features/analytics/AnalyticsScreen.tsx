"use client";
import { useState } from "react";
import { WeeklyReflectionPanel } from "@/features/weekly-reflection/WeeklyReflectionPanel";
import Link from "next/link";
import { MoodTrendChart } from "@/features/dashboard/MoodTrendChart";
import { useQuery } from "@tanstack/react-query";
import { analyticsRanges, type AnalyticsResponse } from "./types";
import styles from "@/features/dashboard/DashboardScreen.module.css";
import pageStyles from "./AnalyticsScreen.module.css";

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
    <section className={`${styles.dashboard} ${pageStyles.page}`}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>YOUR REFLECTIONS, IN CONTEXT</p>
          <h1>Your patterns over time</h1>
          <p>Statistics from your recorded entries. Missing values stay unknown.</p>
        </div>
        <label className={pageStyles.range}>
          Date range{" "}
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
            {data.statistics.journalCount === 0 ? (
              <section className={styles.checkIn} aria-labelledby="analytics-empty-heading">
                <div>
                  <h2 id="analytics-empty-heading">Every pattern starts with a reflection</h2>
                  <p>
                    No entries in this date range yet. Write a little about today, or select a
                    longer range to revisit earlier reflections.
                  </p>
                  <Link className={styles.primary} href="/journal/new">
                    Write a reflection
                  </Link>
                  {days !== "90" && (
                    <button type="button" onClick={() => setDays("90")}>
                      Explore the last 90 days
                    </button>
                  )}
                </div>
              </section>
            ) : data.statistics.moodTrend.filter((day) => day.journalCount > 0).length < 5 ? (
              <section className={styles.panel} aria-labelledby="analytics-growing-heading">
                <h2 id="analytics-growing-heading">Your history is taking shape</h2>
                <p>
                  A few reflections are a starting point, not a reliable pattern. Keep checking in
                  at your own pace. Add sleep, exercise and energy when you know them; leave them
                  blank when you do not.
                </p>
                <Link href="/journal/new">Add a reflection</Link>
              </section>
            ) : null}
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
            <WeeklyReflectionPanel userId={userId} />
            <section className={styles.panel}>
              <h2>Personal insights</h2>
              <p>
                Gentle summaries of your own records, not predictions. Relationships do not
                establish cause and effect.
              </p>
              {data.insights.map((insight) => (
                <p key={insight.id}>{insight.text}</p>
              ))}
            </section>
            <section className={styles.panel}>
              <h2>Mood trend</h2>
              <p>
                Daily average mood on a 1–10 scale. Gaps mean no mood was recorded; they are not
                filled in.
              </p>
              <MoodTrendChart days={data.statistics.moodTrend} />
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
            <section className={styles.panel} aria-labelledby="sleep-comparison-heading">
              <h2 id="sleep-comparison-heading">Mood and sleep</h2>
              <p>{data.sleepComparison.summary}</p>
              {data.sleepComparison.status === "insufficient_data" && (
                <p>
                  Record sleep alongside your reflections when you know it. A comparison needs five
                  days in each sleep group.
                  {days === "7"
                    ? " Select 30 or 90 days to give this comparison enough room."
                    : " Try a longer range if you have older entries."}
                </p>
              )}
              <div className={styles.chartDetails}>
                <table>
                  <caption>Daily mood by recorded sleep</caption>
                  <thead>
                    <tr>
                      <th scope="col">Sleep</th>
                      <th scope="col">Days</th>
                      <th scope="col">Average mood</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">At least 7 hours</th>
                      <td>{data.sleepComparison.atLeast7Hours.sampleSize}</td>
                      <td>
                        {data.sleepComparison.atLeast7Hours.averageMood == null
                          ? "Not recorded"
                          : `${data.sleepComparison.atLeast7Hours.averageMood}/10`}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Less than 7 hours</th>
                      <td>{data.sleepComparison.lessThan7Hours.sampleSize}</td>
                      <td>
                        {data.sleepComparison.lessThan7Hours.averageMood == null
                          ? "Not recorded"
                          : `${data.sleepComparison.lessThan7Hours.averageMood}/10`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Each UTC day counts once. Multiple sleep records on a day are averaged before
                grouping. {data.sleepComparison.excludedDaysWithoutSleep} journal days without sleep
                data were excluded.
              </p>
            </section>
            <section className={styles.panel} aria-labelledby="exercise-comparison-heading">
              <h2 id="exercise-comparison-heading">Mood, energy and exercise</h2>
              {(["mood", "energy"] as const).map((metric) => {
                const comparison = data.exerciseComparison[metric];
                return (
                  <div key={metric}>
                    <h3>{metric === "mood" ? "Mood" : "Energy"}</h3>
                    <p>{comparison.summary}</p>
                    {comparison.status === "insufficient_data" && (
                      <p>
                        Record exercise status and {metric} as part of your usual check-ins. This
                        view needs five recorded days in each group; no need to change your routine
                        to fill it.
                        {days === "7" ? " Select 30 or 90 days to include enough days." : ""}
                      </p>
                    )}
                    <div className={styles.chartDetails}>
                      <table>
                        <caption>
                          {metric === "mood" ? "Mood" : "Energy"} by recorded exercise
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Day type</th>
                            <th scope="col">Days with {metric}</th>
                            <th scope="col">Average {metric}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <th scope="row">Exercise</th>
                            <td>{comparison.exercise.sampleSize}</td>
                            <td>
                              {comparison.exercise.average == null
                                ? "Not recorded"
                                : `${comparison.exercise.average}/10`}
                            </td>
                          </tr>
                          <tr>
                            <th scope="row">Non-exercise</th>
                            <td>{comparison.nonExercise.sampleSize}</td>
                            <td>
                              {comparison.nonExercise.average == null
                                ? "Not recorded"
                                : `${comparison.nonExercise.average}/10`}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              <p>
                Each UTC day counts once, using its average recorded mood and energy. Days with no
                energy recorded are excluded from the energy comparison.
                {data.exerciseComparison.excludedDaysWithoutExercise} journal days without exercise
                status and {data.exerciseComparison.excludedDaysWithConflictingExercise} days with
                conflicting exercise records were excluded.
              </p>
            </section>
            <section className={styles.panel} aria-labelledby="tag-analysis-heading">
              <h2 id="tag-analysis-heading">Top tags and mood</h2>
              <p>
                Tags need at least {data.statistics.tagCriteria.minimumObservations} reflections
                across {data.statistics.tagCriteria.minimumDays} UTC days in this period. Showing up
                to {data.statistics.tagCriteria.limit} qualifying tags, ordered by frequency.
              </p>
              {data.statistics.tagFrequency.length ? (
                <div className={styles.chartDetails}>
                  <table>
                    <caption>Average mood by journal tag</caption>
                    <thead>
                      <tr>
                        <th scope="col">Tag</th>
                        <th scope="col">Reflections</th>
                        <th scope="col">Days</th>
                        <th scope="col">Average mood</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.statistics.tagFrequency.map((item) => (
                        <tr key={item.tag}>
                          <th scope="row">{item.tag}</th>
                          <td>{item.entryCount}</td>
                          <td>{item.distinctDays}</td>
                          <td>{item.averageMood}/10</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>
                  Not enough observations for tag comparisons yet. Tags will appear once they meet
                  the minimum in this period. Add tags that describe your reflections, or choose a
                  longer range.
                </p>
              )}
              <p>
                Averages describe tagged reflections, not effects of a tag on mood. Reflections with
                multiple tags contribute to each tag. These overlapping groups do not establish
                causation or statistical significance.
              </p>
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
