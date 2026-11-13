"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  musicGenres,
  musicLanguages,
  musicPreferencesSchema,
  type MusicPreferences,
} from "./preferences";
import styles from "./MusicPage.module.css";

export function MusicPreferencesForm({ userId }: { userId: string }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<MusicPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const query = useQuery({
    queryKey: ["music-preferences", userId],
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/music/preferences", { signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error("Could not load music preferences.");
      return musicPreferencesSchema.parse(data.preferences);
    },
  });
  const values = draft ?? query.data;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const parsed = musicPreferencesSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicPreferences: parsed.data }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not save music preferences."
        );
      const saved = musicPreferencesSchema.parse(data.settings.musicPreferences);
      setDraft(saved);
      client.setQueryData(["music-preferences", userId], saved);
      await client.cancelQueries({ queryKey: ["music-recommendations", userId] });
      client.removeQueries({ queryKey: ["music-recommendations", userId] });
      await client.invalidateQueries({ queryKey: ["music-source", userId] });
      setMessage("Music preferences saved. Your next recommendations will use them.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save music preferences.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  return (
    <section className={styles.panel} aria-labelledby="music-preferences-heading">
      <h2 id="music-preferences-heading">Music preferences</h2>
      <p>
        Favorites guide selection. Disliked genres are excluded using catalog labels. Choose up to
        five of each and three preferred languages.
      </p>
      <p>
        Language choices guide searches; iTunes does not provide a reliable track-language field, so
        a language match cannot be guaranteed. Unclassified genres are omitted when you exclude
        genres.
      </p>
      {query.isPending ? (
        <p role="status">Loading music preferences…</p>
      ) : query.error ? (
        <div role="alert">
          <p>{query.error.message}</p>
          <button onClick={() => void query.refetch()}>Retry preferences</button>
        </div>
      ) : (
        values && (
          <form onSubmit={save}>
            <fieldset disabled={saving}>
              {(["favoriteGenres", "dislikedGenres"] as const).map((field) => (
                <fieldset key={field}>
                  <legend>
                    {field === "favoriteGenres" ? "Favorite genres" : "Disliked genres"}
                  </legend>
                  <div className={styles.choices}>
                    {musicGenres.map((genre) => (
                      <label key={genre}>
                        <input
                          type="checkbox"
                          checked={values[field].includes(genre)}
                          disabled={
                            !values[field].includes(genre) &&
                            (values[field].length >= 5 ||
                              values[
                                field === "favoriteGenres" ? "dislikedGenres" : "favoriteGenres"
                              ].includes(genre))
                          }
                          onChange={(event) => {
                            setMessage("");
                            setDraft({
                              ...values,
                              [field]: event.target.checked
                                ? [...values[field], genre]
                                : values[field].filter((item) => item !== genre),
                            });
                          }}
                        />
                        {genre}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <fieldset>
                <legend>Preferred languages</legend>
                <div className={styles.choices}>
                  {musicLanguages.map((language) => (
                    <label key={language}>
                      <input
                        type="checkbox"
                        checked={values.preferredLanguages.includes(language)}
                        disabled={
                          !values.preferredLanguages.includes(language) &&
                          values.preferredLanguages.length >= 3
                        }
                        onChange={(event) => {
                          setMessage("");
                          setDraft({
                            ...values,
                            preferredLanguages: event.target.checked
                              ? [...values.preferredLanguages, language]
                              : values.preferredLanguages.filter((item) => item !== language),
                          });
                        }}
                      />
                      {language}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className={styles.energy}>
                <span>
                  <input
                    type="checkbox"
                    checked={values.allowExplicit}
                    onChange={(event) => {
                      setMessage("");
                      setDraft({ ...values, allowExplicit: event.target.checked });
                    }}
                  />{" "}
                  Allow explicit tracks
                </span>
                <span>
                  Off by default. When off, only tracks labeled clean or not explicit are shown;
                  unrated tracks are omitted.
                </span>
              </label>
              <button type="submit">
                {saving ? "Saving preferences…" : "Save music preferences"}
              </button>
            </fieldset>
          </form>
        )
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
