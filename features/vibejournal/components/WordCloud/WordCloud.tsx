import { type MoodEntry } from "@/lib/mood";
import styles from "./WordCloud.module.css";

export function WordCloud({ entries }: { entries: MoodEntry[] }) {
  const counts = entries.flatMap((entry) => entry.tags).reduce<Record<string, number>>((acc, tag) => {
    acc[tag] = (acc[tag] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className={styles.wordCloud}>
      {Object.entries(counts).map(([tag, count]) => (
        <span key={tag} style={{ fontSize: `${0.9 + count * 0.22}rem` }}>{tag}</span>
      ))}
    </div>
  );
}
