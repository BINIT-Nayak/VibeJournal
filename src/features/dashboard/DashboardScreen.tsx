import Link from "next/link";
import { MusicRecommendationsPanel } from "@/features/music/MusicRecommendationsPanel";
import {
  ArrowRight,
  BookOpen,
  Check,
  Leaf,
  PenLine,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { DashboardResponse } from "./types";
import { MoodTrendChart } from "./MoodTrendChart";
import styles from "./DashboardScreen.module.css";

export function DashboardScreen({ data }: { data: DashboardResponse }) {
  const date = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: data.timeZone,
  }).format(new Date(data.asOf));
  const stats = [
    {
      label: "Average mood",
      value: data.weeklyAverageMood,
      suffix: "/10",
      note: "Over the last 7 days",
      Icon: TrendingUp,
    },
    {
      label: "Average energy",
      value: data.averageEnergy,
      suffix: "/10",
      note: "Recorded energy · 7 days",
      Icon: Zap,
    },
    {
      label: "This week",
      value: data.weeklyJournalCount,
      suffix: "",
      note: "Reflections in the last 7 days",
      Icon: PenLine,
    },
    {
      label: "Your journal",
      value: data.journalCount,
      suffix: "",
      note: "Total active reflections",
      Icon: BookOpen,
    },
  ];
  return (
    <section className={styles.dashboard}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>A LITTLE SPACE FOR YOU</p>
          <h1>
            A moment to check in{data.user.name ? `, ${data.user.name.trim().split(/\s+/)[0]}` : ""}
            .
          </h1>
          <p>Notice how you feel. Make room for what matters.</p>
        </div>
        <time dateTime={data.asOf}>{date}</time>
      </header>
      <section className={styles.checkIn} aria-labelledby="check-in-heading">
        <div className={styles.checkInCopy}>
          <span className={styles.badge}>
            {data.today.hasJournaled ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Leaf size={14} aria-hidden="true" />
            )}
            {data.today.hasJournaled ? "TODAY'S CHECK-IN COMPLETE" : "TODAY'S CHECK-IN"}
          </span>
          <h2 id="check-in-heading">
            {data.today.hasJournaled ? "You made time for yourself." : "How are you feeling today?"}
          </h2>
          <p>
            {data.today.hasJournaled
              ? "Your reflection is here whenever you want to return to it."
              : "A sentence, a feeling, a small moment. Start wherever you are."}
          </p>
          <Link
            className={styles.primary}
            href={
              data.today.latestEntryId ? `/journal/${data.today.latestEntryId}` : "/journal/new"
            }
          >
            {data.today.hasJournaled ? "View today's entry" : "Write today's entry"}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.checkInArt} aria-hidden="true">
          <Leaf size={64} strokeWidth={1} />
          <span>
            One moment.
            <br />
            Just for you.
          </span>
        </div>
      </section>
      <div className={styles.sectionHeading}>
        <h2>Your week, at a glance</h2>
        <span>Today + the previous 6 days</span>
      </div>
      <dl className={styles.stats}>
        {stats.map(({ label, value, suffix, note, Icon }) => (
          <div key={label}>
            <dt>
              <Icon size={18} aria-hidden="true" />
              {label}
            </dt>
            <dd>
              {value == null ? (
                <span className={styles.noValue}>Not recorded</span>
              ) : (
                <>
                  {value}
                  <span>{suffix}</span>
                </>
              )}
            </dd>
            <p>{note}</p>
          </div>
        ))}
      </dl>
      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} aria-labelledby="trend-heading">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>SMALL MOMENTS, OVER TIME</p>
                <h2 id="trend-heading">Your mood over 7 days</h2>
              </div>
              <TrendingUp size={22} aria-hidden="true" />
            </div>
            <p className={styles.period}>
              {data.period.startDate} – {data.period.endDate} · {data.timeZone}
            </p>
            <MoodTrendChart days={data.moodTrend} />
          </section>
          <section className={styles.panel} aria-labelledby="recent-heading">
            <div className={styles.sectionHeading}>
              <h2 id="recent-heading">Recent reflections</h2>
              <Link href="/journal">
                View all <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {data.recentEntries.length ? (
              <ul className={styles.recent}>
                {data.recentEntries.map((entry) => (
                  <li key={entry.id}>
                    <Link className={styles.entryLink} href={`/journal/${entry.id}`}>
                      <div>
                        <time dateTime={entry.createdAt}>
                          {new Intl.DateTimeFormat("en", {
                            month: "short",
                            day: "numeric",
                            timeZone: data.timeZone,
                          }).format(new Date(entry.createdAt))}
                        </time>
                        <h3>{entry.title || entry.note.slice(0, 90)}</h3>
                        {entry.title && <p>{entry.note}</p>}
                      </div>
                      <span className={styles.moodPill}>Mood {entry.valence}/10</span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyRecent}>
                <BookOpen size={28} aria-hidden="true" />
                <h3>Your first page is waiting.</h3>
                <p>No perfect words needed. Just a little honesty.</p>
                <Link href="/journal/new">
                  Write your first entry <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            )}
          </section>
        </div>
        <aside className={styles.placeholders} aria-label="Insights and music">
          <section className={styles.panel}>
            <span className={styles.placeholderIcon}>
              <Sparkles size={22} aria-hidden="true" />
            </span>
            <span className={styles.comingSoon}>COMING SOON</span>
            <h2>Personal insights</h2>
            <p>{data.personalInsights.message}</p>
            <div className={styles.placeholderNote}>
              A little perspective for your personal journey.
            </div>
          </section>
          <MusicRecommendationsPanel userId={data.user.id} compact />
        </aside>
      </div>
    </section>
  );
}
