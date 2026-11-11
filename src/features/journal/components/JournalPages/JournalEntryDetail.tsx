import Link from "next/link";
import type { MoodEntry } from "../../mood";
import styles from "./JournalEntryDetail.module.css";

export function JournalEntryDetail({ entry, created }: { entry: MoodEntry; created: boolean }) {
  return (
    <article className={styles.detail}>
      {created && (
        <div className={styles.success} role="status">
          <strong>Your entry was saved.</strong>
          <p>Your reflection is ready to revisit whenever you need it.</p>
        </div>
      )}
      <header>
        <p>YOUR JOURNAL</p>
        <h1>{entry.title || "A moment to reflect"}</h1>
        <time dateTime={entry.createdAt}>
          {new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(
            new Date(entry.createdAt)
          )}
        </time>
      </header>
      <p className={styles.content}>{entry.note}</p>
      <p>
        <strong>Mood score:</strong> {entry.valence}/10
      </p>
      {entry.tags.length > 0 && (
        <p>
          <strong>Tags:</strong> {entry.tags.join(", ")}
        </p>
      )}
      <nav aria-label="Journal actions">
        <Link href="/dashboard#journal">Back to journal</Link>
        <Link href="/journal/new">Write another entry</Link>
      </nav>
    </article>
  );
}
