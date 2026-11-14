import { type CSSProperties } from "react";
import { moods, type MoodEntry } from "@/features/journal/mood";
import styles from "@/features/journal/components/CorrelationHeatmap/CorrelationHeatmap.module.css";

export function CorrelationHeatmap({ entries }: { entries: MoodEntry[] }) {
  return (
    <>
      <div className={styles.correlationGrid} role="list" aria-label="Recorded mood by hour">
        {Array.from({ length: 24 }, (_, hour) => {
          const match = entries.find((entry) => new Date(entry.createdAt).getHours() === hour);
          const moodMeta = moods.find((item) => item.key === match?.mood);

          return (
            <span
              role="listitem"
              aria-label={`${hour}:00 — ${match ? moodMeta?.label + ", " + match.valence + " out of 10" : "Not recorded"}`}
              key={hour}
              style={{ "--mood-color": moodMeta?.color ?? "rgba(30,37,40,0.08)" } as CSSProperties}
            >
              {hour}
            </span>
          );
        })}
      </div>
      <details>
        <summary>View hourly mood values</summary>
        <ul>
          {Array.from({ length: 24 }, (_, hour) => {
            const entry = entries.find((item) => new Date(item.createdAt).getHours() === hour);
            return (
              <li key={hour}>
                {hour}:00: {entry ? `${entry.mood}, ${entry.valence}/10` : "Not recorded"}
              </li>
            );
          })}
        </ul>
      </details>
    </>
  );
}
