import { type CSSProperties } from "react";
import { moods, type MoodEntry } from "@/lib/mood";
import styles from "./CorrelationHeatmap.module.css";

export function CorrelationHeatmap({ entries }: { entries: MoodEntry[] }) {
  return (
    <div className={styles.correlationGrid}>
      {Array.from({ length: 24 }, (_, hour) => {
        const match = entries.find((entry) => new Date(entry.createdAt).getHours() === hour);
        const moodMeta = moods.find((item) => item.key === match?.mood);

        return (
          <span key={hour} style={{ "--mood-color": moodMeta?.color ?? "rgba(30,37,40,0.08)" } as CSSProperties}>
            {hour}
          </span>
        );
      })}
    </div>
  );
}
