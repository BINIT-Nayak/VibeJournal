"use client";

import { useId, useRef, type FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { journalCreateSchema, type JournalCreateInput } from "../../schemas";
import { JournalSaveError } from "../../api-client";
import { MoodSelector } from "../MoodSelector/MoodSelector";
import { moods } from "../../mood";
import styles from "./JournalEditor.module.css";

export type JournalEditorProps = {
  mode?: "create" | "edit";
  initialValues?: Partial<JournalCreateInput>;
  onSave: (values: JournalCreateInput) => Promise<void>;
  onCancel?: () => void;
  pending?: boolean;
};

// Mount with a new key when switching entries; form state stays local to this editor.
export function JournalEditor({
  mode = "create",
  initialValues,
  onSave,
  onCancel,
  pending = false,
}: JournalEditorProps) {
  const id = useId();
  const lock = useRef(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<JournalCreateInput>({
    resolver: zodResolver(journalCreateSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      title: "",
      content: "",
      moodScore: 5,
      mood: "neutral",
      energyScore: null,
      sleepHours: null,
      exercised: null,
      socialScore: null,
      tags: [],
      ...initialValues,
    },
  });
  const busy = isSubmitting || pending;
  const validatedSubmit = handleSubmit(async (values) => {
    if (lock.current || pending) return;
    lock.current = true;
    clearErrors("root");
    try {
      await onSave(values);
    } catch (error) {
      if (error instanceof JournalSaveError) {
        let focused = false;
        for (const issue of error.issues) {
          const field = issue.path.split(".")[0];
          if (Object.prototype.hasOwnProperty.call(journalCreateSchema.shape, field)) {
            setError(
              field as keyof JournalCreateInput,
              { type: "server", message: issue.message },
              { shouldFocus: !focused }
            );
            focused = true;
          }
        }
      }
      setError("root.server", {
        message:
          error instanceof Error ? error.message : "Could not save your entry. Please try again.",
      });
    } finally {
      lock.current = false;
    }
  });
  function submit(event?: FormEvent<HTMLFormElement>) {
    if (lock.current || pending) {
      event?.preventDefault();
      return;
    }
    return validatedSubmit(event);
  }
  function error(name: keyof JournalCreateInput) {
    const message =
      errors[name]?.message ??
      (name === "tags" && Array.isArray(errors.tags)
        ? errors.tags.find((item) => item?.message)?.message
        : undefined);
    return message ? (
      <p className={styles.error} id={`${id}-${name}-error`} role="alert">
        {String(message)}
      </p>
    ) : null;
  }
  const accessibility = (name: keyof JournalCreateInput) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });
  return (
    <section className={styles.editor} aria-labelledby={`${id}-heading`}>
      <header>
        <p className={styles.eyebrow}>A MOMENT FOR YOU</p>
        <h1 id={`${id}-heading`}>
          {mode === "edit" ? "Revisit your reflection" : "What's on your mind?"}
        </h1>
        <p>A few words are enough. The rest is optional.</p>
      </header>
      <form
        noValidate
        onSubmit={submit}
        aria-busy={busy}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
      >
        <fieldset disabled={busy} className={styles.fields}>
          <legend className={styles.srOnly}>Journal entry</legend>
          <label htmlFor={`${id}-title`}>
            Title <span>(optional)</span>
          </label>
          <input
            id={`${id}-title`}
            placeholder="Give this moment a name"
            {...register("title")}
            {...accessibility("title")}
          />
          {error("title")}
          <label htmlFor={`${id}-content`}>Your reflection</label>
          <textarea
            id={`${id}-content`}
            rows={9}
            placeholder="Start anywhere. This space is yours."
            {...register("content")}
            {...accessibility("content")}
          />
          {error("content")}
          <div className={styles.row}>
            <div>
              <label htmlFor={`${id}-mood`}>How are you feeling?</label>
              <select id={`${id}-mood`} {...register("mood")}>
                {moods.map((mood) => (
                  <option key={mood.key} value={mood.key}>
                    {mood.symbol} {mood.label}
                  </option>
                ))}
              </select>
              {error("mood")}
            </div>
          </div>
          <Controller
            name="moodScore"
            control={control}
            render={({ field, fieldState }) => (
              <MoodSelector {...field} error={fieldState.error?.message} />
            )}
          />
          <div className={styles.optional}>
            <h2>
              A little context <span>(optional)</span>
            </h2>
            <Controller
              name="energyScore"
              control={control}
              render={({ field }) => (
                <div>
                  <label htmlFor={`${id}-energy`}>
                    Energy <span>{field.value == null ? "Not recorded" : `${field.value}/10`}</span>
                  </label>
                  <div className={styles.energy}>
                    <input
                      id={`${id}-energy`}
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={field.value ?? 5}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                      onBlur={field.onBlur}
                      aria-label="Energy slider"
                    />
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      aria-label="Energy score"
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === "" ? null : Number(event.target.value)
                        )
                      }
                      ref={field.ref}
                      onBlur={field.onBlur}
                      {...accessibility("energyScore")}
                    />
                  </div>
                  {error("energyScore")}
                </div>
              )}
            />
            <div className={styles.row}>
              {(
                [
                  ["sleepHours", "Sleep hours", 24, 0, "0.5"],
                  ["socialScore", "Social score", 10, 1, "1"],
                ] as const
              ).map(([name, label, max, min, step]) => (
                <div key={name}>
                  <label htmlFor={`${id}-${name}`}>{label}</label>
                  <input
                    id={`${id}-${name}`}
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    placeholder="Not recorded"
                    {...register(name, {
                      setValueAs: (value) => (value === "" || value == null ? null : Number(value)),
                    })}
                    {...accessibility(name)}
                  />
                  {error(name)}
                </div>
              ))}
            </div>
            <Controller
              name="exercised"
              control={control}
              render={({ field }) => (
                <div className={styles.exercise}>
                  <label>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={field.value === true}
                      onChange={(event) => field.onChange(event.target.checked)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                    I exercised today
                  </label>
                  <span>{field.value === null ? "Not recorded" : field.value ? "Yes" : "No"}</span>
                  {field.value !== null && (
                    <button type="button" onClick={() => field.onChange(null)}>
                      Clear
                    </button>
                  )}
                </div>
              )}
            />
            {error("exercised")}
          </div>
          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <div>
                <label htmlFor={`${id}-tags`}>
                  Tags <span>(optional)</span>
                </label>
                <input
                  id={`${id}-tags`}
                  defaultValue={field.value?.join(", ")}
                  ref={field.ref}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value.trim()
                        ? event.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean)
                        : []
                    )
                  }
                  onBlur={field.onBlur}
                  placeholder="gratitude, work, rest"
                  {...accessibility("tags")}
                />
                <p className={styles.hint}>Separate tags with commas. Up to 20 tags.</p>
                {error("tags")}
              </div>
            )}
          />
        </fieldset>
        {errors.root?.server && (
          <p className={styles.error} role="alert">
            {errors.root.server.message}
          </p>
        )}
        <div className={styles.actions}>
          <p className={styles.hint} role="status">
            {busy ? "Saving your reflection…" : "Ctrl / ⌘ + Enter to save"}
          </p>
          {onCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!isDirty || window.confirm("Discard your unsaved changes?")) onCancel();
              }}
            >
              Cancel
            </button>
          )}
          <button className={styles.save} type="submit" disabled={busy}>
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Save entry"}
          </button>
        </div>
      </form>
    </section>
  );
}
