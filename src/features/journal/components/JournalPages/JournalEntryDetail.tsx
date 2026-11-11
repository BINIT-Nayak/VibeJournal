import Link from "next/link";
import type { JournalEntryDto } from "../../api-types";
import { moods } from "../../mood";
import { DeleteJournalEntry } from "./DeleteJournalEntry";
import styles from "./JournalEntryDetail.module.css";

function timestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function JournalEntryDetail({
  entry,
  created,
}: {
  entry: JournalEntryDto;
  created: boolean;
}) {
  const feeling = moods.find((mood) => mood.key === entry.mood);
  const context = [
    ["Mood score", `${entry.moodScore}/10${feeling ? ` · ${feeling.label}` : ""}`],
    ["Energy", entry.energyScore == null ? "Not recorded" : `${entry.energyScore}/10`],
    ["Sleep", entry.sleepHours == null ? "Not recorded" : `${entry.sleepHours} hours`],
    ["Exercise", entry.exercised == null ? "Not recorded" : entry.exercised ? "Yes" : "No"],
    ["Social score", entry.socialScore == null ? "Not recorded" : `${entry.socialScore}/10`],
  ];
  return (
    <article className={styles.detail}>
      {created && (
        <div className={styles.success} role="status">
          <strong>Your entry was saved.</strong>
          <p>Your reflection is ready to revisit whenever you need it.</p>
        </div>
      )}
      <header>
        <p>YOUR JOURNAL{entry.archivedAt ? " · ARCHIVED" : ""}</p>
        <h1>{entry.title || "A moment to reflect"}</h1>
        <dl className={styles.timestamps}>
          <div>
            <dt>Created</dt>
            <dd>
              <time dateTime={entry.createdAt}>{timestamp(entry.createdAt)} UTC</time>
            </dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>
              {entry.updatedAt ? (
                <time dateTime={entry.updatedAt}>{timestamp(entry.updatedAt)} UTC</time>
              ) : (
                "Not recorded"
              )}
            </dd>
          </div>
        </dl>
      </header>
      <section aria-labelledby="entry-reflection-heading">
        <h2 id="entry-reflection-heading">Reflection</h2>
        <p className={styles.content}>{entry.content}</p>
      </section>
      <section aria-labelledby="entry-context-heading">
        <h2 id="entry-context-heading">Your context</h2>
        <dl className={styles.context}>
          {context.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="entry-tags-heading">
        <h2 id="entry-tags-heading">Tags</h2>
        {entry.tags.length ? (
          <ul className={styles.tags}>
            {entry.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : (
          <p>No tags added.</p>
        )}
      </section>
      {entry.voiceNote && (
        <section aria-labelledby="entry-transcript-heading">
          <h2 id="entry-transcript-heading">Voice note transcript</h2>
          <p className={styles.content}>{entry.voiceNote}</p>
        </section>
      )}
      <nav aria-label="Journal actions">
        <Link href="/journal">Back to journal</Link>
        <Link href={`/journal/${entry.id}/edit`}>Edit entry</Link>
        <Link href="/journal/new">Write another entry</Link>
      </nav>
      <DeleteJournalEntry id={entry.id} />
    </article>
  );
}
