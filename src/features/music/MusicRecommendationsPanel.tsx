"use client";
import Link from "next/link";
import { useId } from "react";
import { musicIntentLabels } from "./api-types";
import type { MusicIntent } from "./schemas";
import { useMusic } from "./use-music";
import styles from "./MusicPage.module.css";

export function MusicRecommendationsPanel({
  userId,
  compact = false,
}: {
  userId: string;
  compact?: boolean;
}) {
  const id = useId();
  const { selection, select, clear, source, recommendations } = useMusic(userId);
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <h2 id={id}>{compact ? "Music for this moment" : "Your listening direction"}</h2>
      {source.isPending ? (
        <p role="status">Loading your latest mood…</p>
      ) : source.error ? (
        <div role="alert">
          <p>{source.error.message}</p>
          <button onClick={() => void source.refetch()}>Retry mood</button>
        </div>
      ) : !source.data ? (
        <>
          <p>Record a mood to begin. Music is optional, and nothing plays automatically.</p>
          <Link href="/journal/new">Write a check-in</Link>
        </>
      ) : (
        <>
          <p>
            Latest check-in: mood {source.data.mood}/10 · energy{" "}
            {source.data.energy ?? "not recorded"}
            {source.data.energy !== null ? "/10" : ""}
          </p>
          <p>
            Current intent:{" "}
            <strong>{selection ? musicIntentLabels[selection.intent] : "Not selected"}</strong>
          </p>
          <p>
            Favorites: {source.data.preferences.favoriteGenres.join(", ") || "any"} · Excluded:{" "}
            {source.data.preferences.dislikedGenres.join(", ") || "none"} · Languages:{" "}
            {source.data.preferences.preferredLanguages.join(", ") || "any"} · Explicit:{" "}
            {source.data.preferences.allowExplicit ? "allowed" : "excluded"}
          </p>
          <Link href="/dashboard#profile">Edit music preferences</Link>
          <fieldset>
            <legend>What do you want music to do?</legend>
            <div className={styles.choices}>
              {(Object.keys(musicIntentLabels) as MusicIntent[]).map((intent) => (
                <label key={intent}>
                  <input
                    type="radio"
                    name={id}
                    checked={selection?.intent === intent}
                    onChange={() => select(intent, selection?.energy)}
                  />
                  {musicIntentLabels[intent]}
                </label>
              ))}
            </div>
          </fieldset>
          {selection && source.data.energy === null && (
            <label className={styles.energy}>
              Energy for this session
              <select
                value={selection.energy ?? ""}
                onChange={(event) =>
                  select(
                    selection.intent,
                    event.target.value ? Number(event.target.value) : undefined
                  )
                }
              >
                <option value="">Choose 1–10</option>
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <span>This does not change your journal.</span>
            </label>
          )}
          {!selection && (
            <p>
              Choose an intent to find tracks. We send only general music search terms to the
              catalog.
            </p>
          )}
          {selection && <button onClick={clear}>Clear music choice</button>}
          {recommendations.isFetching && <p role="status">Finding tracks for your intent…</p>}
          {recommendations.error && (
            <div role="alert">
              <p>{recommendations.error.message}</p>
              <button
                disabled={recommendations.isFetching}
                onClick={() => void recommendations.refetch()}
              >
                Retry recommendations
              </button>
            </div>
          )}
          {!recommendations.error && recommendations.data && (
            <>
              <p>{recommendations.data.criteria.explanation}</p>
              {!recommendations.data.tracks.length ? (
                <p>
                  No tracks found for this direction and your preferences. Try another intent,
                  review your preferences, or retry.
                </p>
              ) : (
                <ul className={styles.tracks}>
                  {recommendations.data.tracks.slice(0, compact ? 2 : 6).map((track) => (
                    <li key={track.id}>
                      <h3>{track.title}</h3>
                      <p>{track.artist}</p>
                      <p>{track.reason}</p>
                      <a href={track.url} target="_blank" rel="noreferrer">
                        Open on {recommendations.data!.provider} (new tab)
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.note}>{recommendations.data.note}</p>
              {!recommendations.data.tracks.length && (
                <button onClick={() => void recommendations.refetch()}>
                  Retry recommendations
                </button>
              )}
            </>
          )}
        </>
      )}
      {compact && <Link href="/music">Explore music</Link>}
    </section>
  );
}
