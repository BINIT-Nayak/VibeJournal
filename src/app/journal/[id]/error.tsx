"use client";
import Link from "next/link";

export default function EntryError({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>We couldn&apos;t load this entry</h1>
      <p>Please try again in a moment.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
      <p>
        <Link href="/journal">Back to journal</Link>
      </p>
    </section>
  );
}
