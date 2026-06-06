import { type CSSProperties } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Flame,
  Headphones,
  PenLine,
  Sparkles,
  TrendingUp,
  Waves,
} from "lucide-react";
import { MoodCanvas } from "../../components/MoodCanvas/MoodCanvas";
import { moods } from "@/lib/mood";
import type { EntriesProps, Insight, MoodMeta, PlaylistSuggestion } from "../../types";
import styles from "./HomeScreen.module.css";

type HomeScreenProps = EntriesProps & {
  insight: Insight;
  latestMood: MoodMeta;
  onInsights: () => void;
  onJournal: () => void;
  onMusic: () => void;
  onNew: () => void;
  playlist: PlaylistSuggestion;
  streak: number;
  userName?: string | null;
};

export function HomeScreen({
  entries,
  insight,
  latestMood,
  onInsights,
  onJournal,
  onMusic,
  onNew,
  playlist,
  streak,
  userName,
}: HomeScreenProps) {
  const averageMood = getAverage(entries);
  const recentEntries = entries.slice(0, 3);
  const weeklyRhythm = getWeeklyRhythm(entries);
  const topTag = getTopTag(entries);
  const latestEntry = entries[0] ?? null;
  const greeting = getGreeting();
  const firstName = userName?.trim().split(/\s+/)[0] || "there";
  const moodPercent = Math.min(100, Math.max(0, averageMood * 10));

  return (
    <section className={styles.screen}>
      <section className={styles.heroPanel}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            {greeting}, {firstName}
          </p>
          <h1>Your mood has a shape today.</h1>
          <p>
            Capture the moment, notice the pattern, and let VibeJournal turn a scattered day into
            something you can understand.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryAction} onClick={onNew} type="button">
              <PenLine size={18} />
              <span>Check in now</span>
            </button>
            <button className={styles.secondaryAction} onClick={onJournal} type="button">
              <BookOpen size={18} />
              <span>Open journal</span>
            </button>
          </div>
        </div>

        <button
          className={styles.moodStage}
          onClick={onNew}
          style={{ "--mood-color": latestMood.color } as CSSProperties}
          type="button"
        >
          <span className={styles.orbitOne} />
          <span className={styles.orbitTwo} />
          <span className={styles.moodSymbol}>{latestMood.symbol}</span>
          <span className={styles.moodLabel}>{latestMood.label}</span>
          <strong>{averageMood || "Start"}</strong>
          <small>{averageMood ? "average mood" : "first entry"}</small>
        </button>
      </section>

      <section className={styles.statRibbon} aria-label="Mood dashboard stats">
        <article>
          <Flame size={20} />
          <span>Streak</span>
          <strong>{streak} days</strong>
        </article>
        <article>
          <TrendingUp size={20} />
          <span>Avg mood</span>
          <strong>{averageMood || "--"}</strong>
        </article>
        <article>
          <CalendarDays size={20} />
          <span>This week</span>
          <strong>{getEntriesThisWeek(entries)}</strong>
        </article>
        <article>
          <Waves size={20} />
          <span>Top tag</span>
          <strong>{topTag}</strong>
        </article>
      </section>

      <section className={styles.dashboardGrid}>
        <article className={`${styles.panel} ${styles.chartPanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Mood map</p>
              <h2>Last 30 days</h2>
            </div>
            <div className={styles.meter} aria-label={`Mood meter ${moodPercent}%`}>
              <span style={{ width: `${moodPercent}%` }} />
            </div>
          </header>
          <div className={styles.miniChart}>
            <MoodCanvas compact entries={entries} />
          </div>
          <div className={styles.weekRail} aria-label="Weekly reflection rhythm">
            {weeklyRhythm.map((day) => (
              <span key={day.label} className={day.hasEntry ? styles.activeDay : ""}>
                {day.label}
              </span>
            ))}
          </div>
        </article>

        <article className={`${styles.panel} ${styles.insightPanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>AI insight</p>
              <h2>{insight.headline}</h2>
            </div>
            <Sparkles size={24} />
          </header>
          <p>{insight.detail}</p>
          <small>{insight.reframe}</small>
          <button className={styles.linkButton} onClick={onInsights} type="button">
            <span>Explore patterns</span>
            <ArrowRight size={17} />
          </button>
        </article>

        <button className={styles.musicPanel} onClick={onMusic} type="button">
          <span className={styles.musicDisc}>
            <Headphones size={30} />
          </span>
          <span>Soundtrack for now</span>
          <strong>{playlist.title}</strong>
          <small>{playlist.description}</small>
        </button>

        <article className={`${styles.panel} ${styles.recentPanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Recent reflections</p>
              <h2>{recentEntries.length ? "What you wrote lately" : "Start your first thread"}</h2>
            </div>
            <button
              className={styles.iconButton}
              onClick={onJournal}
              type="button"
              aria-label="Open journal"
            >
              <ArrowRight size={18} />
            </button>
          </header>

          <div className={styles.entryStack}>
            {recentEntries.length ? (
              recentEntries.map((entry) => {
                const moodMeta = moods.find((item) => item.key === entry.mood) ?? moods[7];

                return (
                  <button
                    key={entry.id}
                    className={styles.entryPreview}
                    onClick={onJournal}
                    style={{ "--mood-color": moodMeta.color } as CSSProperties}
                    type="button"
                  >
                    <span>{moodMeta.symbol}</span>
                    <div>
                      <strong>{moodMeta.label}</strong>
                      <p>{entry.note}</p>
                    </div>
                    <time>{formatEntryDate(entry.createdAt)}</time>
                  </button>
                );
              })
            ) : (
              <button className={styles.emptyState} onClick={onNew} type="button">
                <PenLine size={20} />
                <span>Write one honest line to begin.</span>
              </button>
            )}
          </div>
        </article>
      </section>

      {latestEntry && (
        <section className={styles.nowStrip}>
          <span>Right now</span>
          <strong>{latestMood.label}</strong>
          <p>{latestEntry.note}</p>
          <button onClick={onNew} type="button">
            Add another check-in
          </button>
        </section>
      )}
    </section>
  );
}

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function getAverage(entries: EntriesProps["entries"]) {
  if (entries.length === 0) return 0;
  return (
    Math.round((entries.reduce((total, entry) => total + entry.valence, 0) / entries.length) * 10) /
    10
  );
}

function getEntriesThisWeek(entries: EntriesProps["entries"]) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  return entries.filter((entry) => new Date(entry.createdAt) >= weekStart).length;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getTopTag(entries: EntriesProps["entries"]) {
  const counts = entries
    .flatMap((entry) => entry.tags)
    .reduce<Record<string, number>>((total, tag) => {
      total[tag] = (total[tag] ?? 0) + 1;
      return total;
    }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "new";
}

function getWeeklyRhythm(entries: EntriesProps["entries"]) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
  const entryDays = new Set(entries.map((entry) => new Date(entry.createdAt).toDateString()));

  return days.map((date) => ({
    hasEntry: entryDays.has(date.toDateString()),
    label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date).slice(0, 1),
  }));
}
