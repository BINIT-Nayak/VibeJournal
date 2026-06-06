import { type CSSProperties } from "react";
import { moods, type MoodEntry } from "@/lib/mood";
import styles from "./EntryCard.module.css";

type EntryCardProps = {
  entry: MoodEntry;
  onArchive?: (entry: MoodEntry) => void;
  onDelete?: (entryId: string) => void;
  onEdit?: (entry: MoodEntry) => void;
  onView?: (entryId: string) => void;
};

export function EntryCard({ entry, onArchive, onDelete, onEdit, onView }: EntryCardProps) {
  const moodMeta = moods.find((item) => item.key === entry.mood) ?? moods[7];

  return (
    <article
      className={styles.entryCard}
      style={{ "--mood-color": moodMeta.color } as CSSProperties}
    >
      <div className={styles.entryTop}>
        <span>
          {moodMeta.symbol} {moodMeta.label}
        </span>
        <time>
          {new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(entry.createdAt))}
        </time>
      </div>
      {entry.archivedAt && <span className={styles.archiveBadge}>Archived</span>}
      <p>{entry.note}</p>
      <div className={styles.entryMetrics}>
        <span>Energy {entry.energy}</span>
        <span>Stress {entry.stress}</span>
        {typeof entry.sleepHours === "number" && <span>Sleep {entry.sleepHours}h</span>}
        {typeof entry.exerciseMinutes === "number" && (
          <span>Movement {entry.exerciseMinutes}m</span>
        )}
        {typeof entry.socialLevel === "number" && <span>Social {entry.socialLevel}/10</span>}
      </div>
      {entry.voiceNote && <p className={styles.voiceNote}>{entry.voiceNote}</p>}
      {entry.photoNames && entry.photoNames.length > 0 && (
        <div className={styles.attachmentRow}>
          {entry.photoNames.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      )}
      <div className={styles.tagRow}>
        {entry.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      {(onView || onEdit || onArchive || onDelete) && (
        <div className={styles.entryActions}>
          {onView && (
            <button onClick={() => onView(entry.id)} type="button">
              View
            </button>
          )}
          {onEdit && (
            <button onClick={() => onEdit(entry)} type="button">
              Edit
            </button>
          )}
          {onArchive && (
            <button onClick={() => onArchive(entry)} type="button">
              {entry.archivedAt ? "Restore" : "Archive"}
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(entry.id)} type="button">
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}
