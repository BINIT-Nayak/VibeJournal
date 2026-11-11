"use client";

import { forwardRef, useId } from "react";
import styles from "./MoodSelector.module.css";

const states = [
  { value: 1, emoji: "😞", label: "Very low" },
  { value: 2, emoji: "😔", label: "Low" },
  { value: 3, emoji: "🙁", label: "Down" },
  { value: 4, emoji: "😕", label: "A little low" },
  { value: 5, emoji: "😐", label: "Neutral" },
  { value: 6, emoji: "🙂", label: "Okay" },
  { value: 7, emoji: "😊", label: "Good" },
  { value: 8, emoji: "😄", label: "Very good" },
  { value: 9, emoji: "😁", label: "Great" },
  { value: 10, emoji: "🤩", label: "Wonderful" },
] as const;

type MoodSelectorProps = {
  value?: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  name?: string;
  disabled?: boolean;
  error?: string;
};

export const MoodSelector = forwardRef<HTMLInputElement, MoodSelectorProps>(function MoodSelector(
  { value, onChange, onBlur, name, disabled, error },
  ref
) {
  const id = useId();
  const selected = states.find((state) => state.value === value);
  const description = `${id}-help${error ? ` ${id}-error` : ""}`;
  return (
    <fieldset
      className={styles.selector}
      disabled={disabled}
      aria-describedby={description}
      aria-invalid={Boolean(error)}
    >
      <legend>
        Mood score <span>(1–10)</span>
      </legend>
      <p id={`${id}-help`} className={styles.help}>
        Choose a number. 1 is very low; 10 is wonderful. Use arrow keys to change your selection.
      </p>
      <div className={styles.options}>
        {states.map((state) => (
          <label key={state.value} className={styles.option}>
            <input
              ref={state.value === (selected?.value ?? 1) ? ref : undefined}
              type="radio"
              name={name ?? `${id}-mood`}
              value={state.value}
              checked={value === state.value}
              onChange={() => onChange(state.value)}
              onBlur={onBlur}
              aria-label={`${state.value} out of 10 — ${state.label}`}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            <span className={styles.emoji} aria-hidden="true">
              {state.emoji}
            </span>
            <strong>{state.value}</strong>
            <span className={styles.caption}>{state.label}</span>
          </label>
        ))}
      </div>
      <p className={styles.selection}>
        {selected
          ? `Selected: ${selected.value}/10 — ${selected.label}`
          : "No mood score selected."}
      </p>
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
});
