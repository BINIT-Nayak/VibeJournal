import { type CSSProperties } from "react";
import { moods, type MoodEntry } from "@/lib/mood";
import styles from "./EntryCard.module.css";

export function EntryCard({ entry }: { entry: MoodEntry }) {
  const moodMeta = moods.find((item) => item.key === entry.mood) ?? moods[7];

  return (
    <article className={styles.entryCard} style={{ "--mood-color": moodMeta.color } as CSSProperties}>
      <div className={styles.entryTop}>
        <span>{moodMeta.symbol} {moodMeta.label}</span>
        <time>
          {new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
          }).format(new Date(entry.createdAt))}
        </time>
      </div>
      <p>{entry.note}</p>
      <div className={styles.entryMetrics}>
        <span>Energy {entry.energy}</span>
        <span>Stress {entry.stress}</span>
      </div>
      <div className={styles.tagRow}>
        {entry.tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
    </article>
  );
}
