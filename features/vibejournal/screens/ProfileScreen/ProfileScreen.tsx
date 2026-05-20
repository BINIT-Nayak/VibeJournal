import { PageTitle } from "../../components/SectionTitle/SectionTitle";
import { StatCard } from "../../components/StatCard/StatCard";
import type { EntriesProps } from "../../types";
import styles from "./ProfileScreen.module.css";

type ProfileScreenProps = EntriesProps & {
  averageMood: number;
  darkMode: boolean;
  onToggleTheme: () => void;
  streak: number;
};

export function ProfileScreen({
  averageMood,
  darkMode,
  entries,
  onToggleTheme,
  streak
}: ProfileScreenProps) {
  return (
    <section className={styles.screen}>
      <PageTitle eyebrow="Profile" title="Your space" />
      <div className={styles.statsGrid}>
        <StatCard label="Average mood" value={`${averageMood}/10`} />
        <StatCard label="Best day" value="Friday" />
        <StatCard label="Entries" value={String(entries.length)} />
        <StatCard label="Streak" value={`${streak} days`} />
      </div>
      <section className={styles.settingsList}>
        <button type="button">Export my data</button>
        <button type="button">Delete all entries</button>
        <button type="button">Spotify: Not connected</button>
        <button type="button">Privacy: local-first MVP</button>
        <button onClick={onToggleTheme} type="button">Theme: {darkMode ? "Dark" : "Light"}</button>
      </section>
    </section>
  );
}
