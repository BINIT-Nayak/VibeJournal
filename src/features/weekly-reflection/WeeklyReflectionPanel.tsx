"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  weeklyReflectionSchema,
  weeklySummarySchema,
  type WeeklyPreview,
  type WeeklyReflection,
  type WeeklySummary,
} from "./schemas";
import styles from "@/features/dashboard/DashboardScreen.module.css";

export function WeeklyReflectionPanel({ userId }: { userId: string }) {
  const [opened, setOpened] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    summary: WeeklySummary;
    reflection: WeeklyReflection;
  } | null>(null);
  const sending = useRef(false);
  const preview = useQuery({
    queryKey: ["weekly-reflection-preview", userId],
    enabled: opened,
    retry: false,
    queryFn: async ({ signal }): Promise<WeeklyPreview> => {
      const response = await fetch("/api/weekly-reflection", { signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Could not load this week.");
      return data;
    },
  });
  async function generate() {
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/weekly-reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Could not generate a reflection.");
      setResult({
        summary: weeklySummarySchema.parse(data.summary),
        reflection: weeklyReflectionSchema.parse(data.reflection),
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not generate a weekly reflection. Your journal is unchanged."
      );
      void preview.refetch();
    } finally {
      sending.current = false;
      setPending(false);
    }
  }
  const summary = result?.summary ?? preview.data?.summary;
  return (
    <section className={styles.panel} aria-labelledby="weekly-reflection-heading">
      <h2 id="weekly-reflection-heading">Your weekly reflection</h2>
      <p>
        An optional AI perspective on the last seven days, including today. We send only the compact
        summary shown below, including recurring AI-derived theme labels. Journal titles, raw entry
        text, transcripts and earlier reflection prompts are not sent.
      </p>
      {!opened && (
        <button type="button" onClick={() => setOpened(true)}>
          Review weekly summary
        </button>
      )}
      {opened && preview.isPending && <p role="status">Preparing your weekly summary…</p>}
      {opened && preview.error && (
        <div role="alert">
          <p>Could not load this week.</p>
          <button type="button" onClick={() => void preview.refetch()}>
            Retry summary
          </button>
        </div>
      )}
      {opened && summary && (
        <>
          <p>
            {summary.period.startDate} – {summary.period.endDate} · UTC · {summary.journalCount}{" "}
            reflections across {summary.recordedDays} days
          </p>
          <dl className={styles.stats}>
            <div>
              <dt>Average mood</dt>
              <dd>{summary.averageMood ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Average energy</dt>
              <dd>{summary.averageEnergy ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Average sleep (hours)</dt>
              <dd>{summary.sleep.averageHours ?? "Not recorded"}</dd>
            </div>
          </dl>
          <p>
            Sleep: {summary.sleep.recordedEntries} recorded reflections,{" "}
            {summary.sleep.missingEntries} missing. Exercise: {summary.exercise.exerciseDays} days;
            non-exercise: {summary.exercise.nonExerciseDays}; unknown:{" "}
            {summary.exercise.unknownDays}; conflicting: {summary.exercise.conflictingDays}.
          </p>
          <div className={styles.chartDetails}>
            <table>
              <caption>Seven-day summary sent to AI · mood 1–10 · sleep in hours</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Entries</th>
                  <th scope="col">Mood</th>
                  <th scope="col">Sleep</th>
                </tr>
              </thead>
              <tbody>
                {summary.days.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{day.date}</th>
                    <td>{day.entries}</td>
                    <td>{day.averageMood ?? "Unknown"}</td>
                    <td>{day.averageSleepHours ?? "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Recurring themes from saved AI interpretations</h3>
          {summary.topThemes.length ? (
            <ul>
              {summary.topThemes.map((theme) => (
                <li key={theme.theme}>
                  {theme.theme} · {theme.entries} entries across {theme.days} days
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No recurring themes with at least two recorded days. No themes will be invented to
              fill the gap.
            </p>
          )}
          {!preview.data?.eligible && (
            <p>
              Start with a few check-ins: a weekly reflection needs entries on at least three days.
              You can still review your recorded summary above.
            </p>
          )}
          {!preview.data?.consent && (
            <p>
              AI analysis is off.{" "}
              <Link href="/dashboard#profile">Review AI consent in Settings</Link>.
            </p>
          )}
          <button
            type="button"
            disabled={pending || !preview.data?.consent || !preview.data?.eligible}
            onClick={() => void generate()}
          >
            {pending ? "Reflecting on your week…" : "Generate weekly reflection"}
          </button>
          {pending && <p role="status">Generating from your structured summary…</p>}
          <p>
            The summary is refreshed when you generate. Three days is a minimum for context, not
            proof of a pattern.
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <section aria-labelledby="weekly-ai-result-heading">
          <h3 id="weekly-ai-result-heading">AI-generated weekly interpretation</h3>
          <p>
            This may misread your experience. It is not a medical diagnosis or evidence that one
            habit caused a change.
          </p>
          <p>{result.reflection.reflection}</p>
          <ul>
            {result.reflection.observations.map((observation, index) => (
              <li key={index}>{observation}</li>
            ))}
          </ul>
          <h4>A question to sit with, if useful</h4>
          <p>{result.reflection.reflectionPrompt}</p>
          <p>
            This reflection is shown for this visit and is not saved. Your original entries remain
            unchanged.
          </p>
        </section>
      )}
    </section>
  );
}
