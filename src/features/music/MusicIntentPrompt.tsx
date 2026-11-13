"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { getMusicTimeOfDay, recommendMusicCriteria } from "./recommendation-service";
import type { MusicIntent, MusicTimeOfDay } from "./schemas";
import styles from "./MusicIntentPrompt.module.css";

const choices: Array<{ value: MusicIntent; label: string }> = [
  { value: "match", label: "Match my mood" },
  { value: "uplift", label: "Lift my mood" },
  { value: "calm", label: "Calm me down" },
  { value: "focus", label: "Help me focus" },
];

/** A post-save choice, scoped to this visit. Never updates the journal or account. */
export function MusicIntentPrompt({
  mood,
  energy,
  userId,
}: {
  mood: number;
  energy: number | null;
  userId: string;
}) {
  const client = useQueryClient();
  const id = useId();
  const [timeOfDay, setTimeOfDay] = useState<MusicTimeOfDay | null>(null);
  const [intent, setIntent] = useState<MusicIntent | null>(null);
  const [listeningEnergy, setListeningEnergy] = useState<number | null>(energy);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed)
    return (
      <button type="button" onClick={() => setDismissed(false)}>
        Choose music (optional)
      </button>
    );

  const criteria =
    intent && timeOfDay && listeningEnergy !== null
      ? recommendMusicCriteria({
          mood,
          energy: listeningEnergy,
          primaryEmotion: null,
          intent,
          timeOfDay,
        })
      : null;
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <fieldset aria-describedby={`${id}-note`}>
        <legend id={id}>What do you want music to do?</legend>
        <p id={`${id}-note`}>
          Optional. Your entry is already saved. This choice is only used for music during this
          visit.
        </p>
        <div className={styles.choices}>
          {choices.map((choice) => (
            <label key={choice.value}>
              <input
                type="radio"
                name={id}
                value={choice.value}
                checked={intent === choice.value}
                onChange={() => {
                  setTimeOfDay(getMusicTimeOfDay(new Date().getHours()));
                  setIntent(choice.value);
                }}
              />
              {choice.label}
            </label>
          ))}
        </div>
      </fieldset>
      {intent && energy === null && (
        <label className={styles.energy}>
          Energy for this listening session
          <select
            value={listeningEnergy ?? ""}
            onChange={(event) =>
              setListeningEnergy(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">Choose energy (1–10)</option>
            {Array.from({ length: 10 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
          <span>Energy was not recorded. This selection will not change your journal.</span>
        </label>
      )}
      {criteria && (
        <div role="status" className={styles.result}>
          <p>{criteria.explanation}</p>
          <Link
            href="/music"
            onClick={() =>
              client.setQueryData(["music-selection", userId], {
                intent,
                timeOfDay,
                ...(energy === null ? { energy: listeningEnergy } : {}),
              })
            }
          >
            See recommended tracks
          </Link>
          <p>
            Your listening choice carries into Music for this app session. Only general search terms
            are sent to the music catalog.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setIntent(null);
          setListeningEnergy(energy);
          setDismissed(true);
        }}
      >
        Skip music for now
      </button>
    </section>
  );
}
