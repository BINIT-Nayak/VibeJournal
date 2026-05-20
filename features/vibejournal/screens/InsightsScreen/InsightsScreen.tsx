import { MoodCanvas } from "../../components/MoodCanvas/MoodCanvas";
import { CorrelationHeatmap } from "../../components/CorrelationHeatmap/CorrelationHeatmap";
import { PageTitle, PanelTitle } from "../../components/SectionTitle/SectionTitle";
import { WordCloud } from "../../components/WordCloud/WordCloud";
import type { EntriesProps, Insight, InsightTab } from "../../types";
import styles from "./InsightsScreen.module.css";

type InsightsScreenProps = EntriesProps & {
  insight: Insight;
  onTab: (value: InsightTab) => void;
  tab: InsightTab;
};

const insightTabs: InsightTab[] = ["daily", "weekly", "monthly", "patterns"];

export function InsightsScreen({ entries, insight, onTab, tab }: InsightsScreenProps) {
  return (
    <section className={styles.screen}>
      <PageTitle eyebrow="Insights" title="Patterns over time" />
      <div className={styles.tabs}>
        {insightTabs.map((item) => (
          <button className={tab === item ? styles.activeTab : ""} key={item} onClick={() => onTab(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      <section className={styles.panel}>
        <PanelTitle eyebrow={tab} title="Mood + energy trend" />
        <div className={styles.largeChart}>
          <MoodCanvas entries={entries} showEnergy />
        </div>
      </section>
      <div className={styles.insightGrid}>
        <section className={styles.panel}>
          <PanelTitle eyebrow="Tags" title="Word cloud" />
          <WordCloud entries={entries} />
        </section>
        <section className={styles.panel}>
          <PanelTitle eyebrow="Correlation" title="Time vs mood" />
          <CorrelationHeatmap entries={entries} />
        </section>
      </div>
      <div className={styles.aiCards}>
        {[insight.headline, insight.detail, insight.reframe].map((text) => (
          <article className={styles.aiCard} key={text}>
            <p>{text}</p>
            <div>
              <button type="button">Copy</button>
              <button type="button">Regenerate</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
