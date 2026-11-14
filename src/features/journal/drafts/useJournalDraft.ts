"use client";

import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { JournalCreateInput } from "../schemas";
import { draftKey, readDraft, removeDraft, writeDraft } from "./storage";

export function useJournalDraft(
  form: UseFormReturn<JournalCreateInput>,
  userId: string,
  entryId?: string,
  baseUpdatedAt?: string
) {
  const { watch, reset, getValues } = form;
  const key = draftKey(userId, entryId);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Checking for a local draft…");
  const version = useRef(baseUpdatedAt);
  const suspended = useRef(false);
  const queue = useRef(Promise.resolve());
  const latestWrite = useRef(0);
  const defaults = useRef(getValues());
  const failure = () =>
    setMessage(
      "Local draft storage is unavailable. Keep this page open until you save your entry."
    );

  useEffect(() => {
    let active = true;
    let subscription: ReturnType<typeof watch> | undefined;
    suspended.current = false;
    setReady(false);
    void readDraft(key, userId)
      .then((draft) => {
        if (!active) return;
        if (draft) {
          version.current = draft.baseUpdatedAt;
          reset(draft.values, { keepDefaultValues: true });
          setRevision((value) => value + 1);
          setMessage(
            draft.baseUpdatedAt && draft.baseUpdatedAt !== baseUpdatedAt
              ? "Local draft restored. The saved entry has changed; review it before saving."
              : "Local draft restored from this browser."
          );
        } else setMessage("Changes are saved locally in this browser only.");
      })
      .catch(() => {
        if (active) failure();
      })
      .finally(() => {
        if (!active) return;
        setReady(true);
        subscription = watch(() => {
          if (suspended.current) return;
          const values = structuredClone(getValues());
          const writeNumber = ++latestWrite.current;
          setMessage("Saving local draft…");
          // Start a write on each change rather than relying on unreliable unload
          // events or a debounce that could lose the final keystrokes on refresh.
          queue.current = queue.current
            .then(async () => {
              await writeDraft({
                key,
                userId,
                values,
                baseUpdatedAt: version.current,
                savedAt: Date.now(),
              });
              if (active && writeNumber === latestWrite.current)
                setMessage("Draft saved on this device. Not yet saved to your journal.");
            })
            .catch(() => {
              if (active) failure();
            });
        });
      });
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [key, userId, baseUpdatedAt, watch, reset, getValues]);

  async function clear() {
    suspended.current = true;
    await queue.current;
    try {
      await removeDraft(key);
    } catch {
      failure();
      return false;
    }
    return true;
  }
  async function discard() {
    if (!(await clear())) {
      suspended.current = false;
      return false;
    }
    version.current = baseUpdatedAt;
    reset(defaults.current);
    setRevision((value) => value + 1);
    suspended.current = false;
    setMessage("Local draft discarded.");
    return true;
  }
  return { ready, revision, message, clear, discard, version };
}
