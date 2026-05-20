import { type CSSProperties } from "react";
import { moods, type MoodEntry } from "@/lib/mood";
import styles from "./Heatmap.module.css";

export function Heatmap({ entries }: { entries: MoodEntry[] }) {
  const cells = Array.from({ length: 35 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (34 - index));
    const entry = entries.find((item) => new Date(item.createdAt).toDateString() === date.toDateString());
    return { date, entry };
  });

  return (
    <div className={styles.heatmap}>
      {cells.map(({ date, entry }) => {
        const moodMeta = moods.find((item) => item.key === entry?.mood);

        return (
          <span
            aria-label={date.toDateString()}
            key={date.toISOString()}
            style={{ "--mood-color": moodMeta?.color ?? "rgba(30,37,40,0.08)" } as CSSProperties}
            title={date.toDateString()}
          />
        );
      })}
    </div>
  );
}
