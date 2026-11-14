import { type CSSProperties } from "react";
import { moods, type MoodEntry } from "@/features/journal/mood";
import styles from "@/features/journal/components/Heatmap/Heatmap.module.css";

export function Heatmap({ entries }: { entries: MoodEntry[] }) {
  const cells = Array.from({ length: 35 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (34 - index));
    const entry = entries.find(
      (item) => new Date(item.createdAt).toDateString() === date.toDateString()
    );
    return { date, entry };
  });

  return (
    <>
      <div className={styles.heatmap} role="list" aria-label="Mood by day">
        {cells.map(({ date, entry }) => {
          const moodMeta = moods.find((item) => item.key === entry?.mood);

          return (
            <span
              role="listitem"
              aria-label={`${date.toDateString()}: ${entry ? moodMeta?.label + ", " + entry.valence + " out of 10" : "Not recorded"}`}
              key={date.toISOString()}
              style={{ "--mood-color": moodMeta?.color ?? "rgba(30,37,40,0.08)" } as CSSProperties}
              title={`${date.toDateString()}: ${entry ? moodMeta?.label + ", " + entry.valence + "/10" : "Not recorded"}`}
            />
          );
        })}
      </div>
      <details>
        <summary>View daily mood values</summary>
        <table>
          <caption>Recorded mood for the last 35 days</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Mood</th>
            </tr>
          </thead>
          <tbody>
            {cells.map(({ date, entry }) => (
              <tr key={date.toISOString()}>
                <th scope="row">{date.toLocaleDateString()}</th>
                <td>{entry ? `${entry.mood}, ${entry.valence}/10` : "Not recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
