import { type CSSProperties } from "react";
import { MoodCanvas } from "../../components/MoodCanvas/MoodCanvas";
import { PanelTitle } from "../../components/SectionTitle/SectionTitle";
import type { EntriesProps, Insight, MoodMeta, PlaylistSuggestion } from "../../types";
import styles from "./HomeScreen.module.css";

type HomeScreenProps = EntriesProps & {
  insight: Insight;
  latestMood: MoodMeta;
  onMusic: () => void;
  onNew: () => void;
  playlist: PlaylistSuggestion;
  streak: number;
};

export function HomeScreen({
  entries,
  insight,
  latestMood,
  onMusic,
  onNew,
  playlist,
  streak,
}: HomeScreenProps) {
  return (
    <section className={styles.screen}>
      <header className={styles.homeHeader}>
        <div>
          <p className={styles.kicker}>Good evening</p>
          <h1>Welcome back, Arin</h1>
        </div>
        <div className={styles.streak}>{streak} day streak 🔥</div>
      </header>

      <section className={styles.moodHero}>
        <button
          className={styles.moodCircle}
          onClick={onNew}
          style={{ "--mood-color": latestMood.color } as CSSProperties}
          type="button"
        >
          <span>{latestMood.symbol}</span>
        </button>
        <p>How are you feeling right now?</p>
        <strong>{latestMood.label}</strong>
      </section>

      <div className={styles.homeGrid}>
        <section className={styles.panel}>
          <PanelTitle eyebrow="Today" title="Mood chart" />
          <div className={styles.miniChart}>
            <MoodCanvas compact entries={entries} />
          </div>
        </section>

        <details className={`${styles.panel} ${styles.insightCard}`} open>
          <summary>
            <span>AI Insight of the Day</span>
            <strong>{insight.headline}</strong>
          </summary>
          <p>{insight.detail}</p>
          <small>{insight.reframe}</small>
        </details>
      </div>

      <button className={styles.musicButton} onClick={onMusic} type="button">
        <span>Play Music for My Mood</span>
        <strong>{playlist.title}</strong>
      </button>
    </section>
  );
}
