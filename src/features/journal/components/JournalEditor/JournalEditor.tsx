"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { journalCreateSchema, type JournalCreateInput } from "../../schemas";
import { useJournalDraft } from "../../drafts/useJournalDraft";
import { JournalSaveError } from "../../api-client";
import { MoodSelector } from "../MoodSelector/MoodSelector";
import { moods } from "../../mood";
import styles from "./JournalEditor.module.css";

export type JournalEditorProps = {
  userId: string;
  entryId?: string;
  baseUpdatedAt?: string;
  onSaved?: () => void;
  onDiscard?: () => void;
  mode?: "create" | "edit";
  initialValues?: Partial<JournalCreateInput>;
  onSave: (values: JournalCreateInput, baseUpdatedAt?: string) => Promise<void>;
  onCancel?: () => void;
  pending?: boolean;
};

// Mount with a new key when switching entries; form state stays local to this editor.
export function JournalEditor({
  userId,
  entryId,
  baseUpdatedAt,
  onSaved,
  onDiscard,
  mode = "create",
  initialValues,
  onSave,
  onCancel,
  pending = false,
}: JournalEditorProps) {
  const id = useId();
  const lock = useRef(false);
  const pendingErrorFocus = useRef<keyof JournalCreateInput | null>(null);
  const form = useForm<JournalCreateInput>({
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
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = form;
  const draft = useJournalDraft(form, userId, entryId, baseUpdatedAt);
  const [draftAnnouncement, setDraftAnnouncement] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDraftAnnouncement(draft.message), 700);
    return () => clearTimeout(timer);
  }, [draft.message]);
  const busy = isSubmitting || pending || !draft.ready;
  useEffect(() => {
    if (busy || !pendingErrorFocus.current) return;
    const field = pendingErrorFocus.current;
    const frame = requestAnimationFrame(() => {
      form.setFocus(field);
      pendingErrorFocus.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [busy, errors, form]);
  const validatedSubmit = handleSubmit(
    async (values) => {
      if (lock.current || pending || !draft.ready) return;
      lock.current = true;
      clearErrors("root");
      try {
        await onSave(values, draft.version.current);
        await draft.clear();
        onSaved?.();
      } catch (error) {
        if (error instanceof JournalSaveError) {
          let focused = false;
          for (const issue of error.issues) {
            const field = issue.path.split(".")[0];
            if (Object.prototype.hasOwnProperty.call(journalCreateSchema.shape, field)) {
              if (!focused) pendingErrorFocus.current = field as keyof JournalCreateInput;
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
    },
    (invalid) => {
      const first = Object.keys(invalid).find((field) =>
        Object.prototype.hasOwnProperty.call(journalCreateSchema.shape, field)
      );
      if (first) pendingErrorFocus.current = first as keyof JournalCreateInput;
    }
  );
  function submit(event?: FormEvent<HTMLFormElement>) {
    if (lock.current || pending || !draft.ready) {
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
      <p className={styles.hint}>{draft.message}</p>
      <p className={styles.srOnly} role="status" aria-atomic="true">
        {draftAnnouncement}
      </p>
      <p className={styles.hint}>
        Local drafts remain on this browser until saved or discarded. Avoid shared devices.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (window.confirm("Discard this local draft and reset the editor?")) {
            if (await draft.discard()) onDiscard?.();
          }
        }}
      >
        Discard local draft
      </button>
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
              <select id={`${id}-mood`} {...register("mood")} {...accessibility("mood")}>
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
                      aria-valuetext={
                        field.value == null
                          ? "Not recorded; use arrow keys to choose a score from 1 to 10"
                          : `${field.value} out of 10`
                      }
                      {...accessibility("energyScore")}
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
                  key={draft.revision}
                  defaultValue={field.value?.join(", ") ?? ""}
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
              onClick={async () => {
                if (!isDirty || window.confirm("Discard your unsaved changes?")) {
                  if (await draft.discard()) onCancel();
                }
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
