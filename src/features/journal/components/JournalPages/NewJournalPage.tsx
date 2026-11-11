"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JournalEditor } from "../JournalEditor/JournalEditor";
import { createJournalEntry } from "../../api-client";
import type { JournalCreateInput } from "../../schemas";

export function NewJournalPage() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [redirecting, setRedirecting] = useState(false);
  async function save(values: JournalCreateInput) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { entry } = await createJournalEntry(values);
      setRedirecting(true);
      router.replace(`/journal/${encodeURIComponent(entry.id)}?created=1`);
    } catch (error) {
      inFlight.current = false;
      throw error;
    }
  }
  return (
    <>
      {redirecting && <p role="status">Your entry is saved. Opening your reflection…</p>}
      <JournalEditor onSave={save} pending={redirecting} onCancel={() => router.push("/journal")} />
    </>
  );
}
