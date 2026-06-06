import { type FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Download,
  Flame,
  HeartPulse,
  Lock,
  LogOut,
  Mail,
  Music2,
  Paintbrush,
  PenLine,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
} from "lucide-react";
import type { ClientUser } from "@/lib/api";
import type { EntriesProps } from "../../types";
import styles from "./ProfileScreen.module.css";

type ProfileScreenProps = EntriesProps & {
  averageMood: number;
  darkMode: boolean;
  isReminderEnabled: boolean;
  onAccountUpdate: (payload: {
    currentPassword?: string;
    email?: string;
    name?: string;
    newPassword?: string;
  }) => void;
  onDeleteEntries: () => void;
  onExportEntries: () => void;
  onLogout: () => void;
  onReminderEnabled: (value: boolean) => void;
  onReminderTime: (value: string) => void;
  onToggleTheme: () => void;
  reminderTime: string;
  spotifyConnected: boolean;
  statusMessage: string;
  streak: number;
  user: ClientUser;
};

export function ProfileScreen({
  averageMood,
  darkMode,
  entries,
  isReminderEnabled,
  onAccountUpdate,
  onDeleteEntries,
  onExportEntries,
  onLogout,
  onReminderEnabled,
  onReminderTime,
  onToggleTheme,
  reminderTime,
  spotifyConnected,
  statusMessage,
  streak,
  user,
}: ProfileScreenProps) {
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const displayName = name || "VibeJournal user";
  const handle = `@${
    email
      .split("@")[0]
      ?.replace(/[^a-z0-9]/gi, "")
      .toLowerCase() || "vibejournal"
  }`;
  const monthlyEntries = getEntriesThisMonth(entries);
  const monthlyAverage =
    getAverage(entries.filter((entry) => isThisMonth(entry.createdAt))) || averageMood;
  const favoriteTag = getFavoriteTag(entries);
  const bestMonth = getBestMonth(entries);
  const reflectiveDay = getMostReflectiveDay(entries);
  const sparkline = getSparklinePoints(entries);
  const moodPercent = Math.min(100, Math.max(0, monthlyAverage * 10));

  function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAccountUpdate({
      name,
      email,
      currentPassword: isChangingPassword ? currentPassword || undefined : undefined,
      newPassword: isChangingPassword ? newPassword || undefined : undefined,
    });
    setCurrentPassword("");
    setNewPassword("");
    setIsEditingProfile(false);
    setIsChangingPassword(false);
  }

  return (
    <section className={styles.screen}>
      <nav className={styles.topBar} aria-label="Profile navigation">
        <button aria-label="Back" onClick={() => window.history.back()} type="button">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <strong>
          <Sparkles size={17} />
          Profile
        </strong>
        <button
          aria-label="Settings"
          onClick={() =>
            document.getElementById("profile-settings")?.scrollIntoView({ behavior: "smooth" })
          }
          type="button"
        >
          <span>Settings</span>
          <Settings size={18} />
        </button>
      </nav>

      <section className={styles.heroSection}>
        <div className={styles.heroIdentity}>
          <button className={styles.avatarButton} type="button" aria-label="Change avatar">
            <span>{getInitials(displayName || email)}</span>
          </button>
          <span className={styles.avatarHint}>Tap to change</span>
          <h1>{displayName}</h1>
          <p>{handle} • Joined May 2025</p>
        </div>

        <div className={styles.moodOrbit} aria-label="Current mood score">
          <span>Feeling Good today</span>
          <strong>{monthlyAverage}</strong>
          <small>/10 month vibe</small>
          <div className={styles.moodMeter}>
            <span style={{ width: `${moodPercent}%` }} />
          </div>
        </div>

        <div className={styles.heroChips} aria-label="Profile highlights">
          <span>
            <Flame size={16} />
            {streak} day streak
          </span>
          <span>
            <TrendingUp size={16} />
            {averageMood} avg mood
          </span>
          <span>
            <HeartPulse size={16} />
            {favoriteTag.tag}
          </span>
        </div>
      </section>

      <section className={styles.quickStats} aria-label="Quick profile stats">
        <article>
          <Flame size={22} />
          <span>Streak</span>
          <strong>{streak} days</strong>
        </article>
        <article>
          <PenLine size={22} />
          <span>Total Entries</span>
          <strong>{entries.length}</strong>
        </article>
        <article>
          <TrendingUp size={22} />
          <span>Avg Mood</span>
          <strong>{averageMood}</strong>
        </article>
      </section>

      <section className={styles.featureGrid}>
        <article className={`${styles.panel} ${styles.progressPanel}`}>
          <header>
            <p>My Progress</p>
            <h2>Mood Overview</h2>
          </header>
          <div className={styles.chartBox}>
            <svg viewBox="0 0 300 90" role="img" aria-label="Mood trend for the last 30 days">
              <polyline
                points={sparkline}
                fill="none"
                stroke="url(#profileMoodLine)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="profileMoodLine" x1="0" x2="1">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#67E8F9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className={styles.detailGrid}>
            <span>Best Month: {bestMonth}</span>
            <span>
              Favorite Tag: &quot;{favoriteTag.tag}&quot; ({favoriteTag.count} times)
            </span>
          </div>
          <button className={styles.pillButton} type="button">
            <span>View Full Statistics</span>
            <ArrowRight size={17} />
          </button>
        </article>

        <article className={`${styles.panel} ${styles.musicPanel}`}>
          <header>
            <p>Music Integration</p>
            <h2>{spotifyConnected ? "Connected to Spotify ✓" : "Spotify not connected"}</h2>
          </header>
          <div className={styles.vinyl}>
            <Music2 size={36} />
          </div>
          <span>Last playlist: &quot;Evening Wind Down&quot;</span>
          <button className={styles.pillButton} type="button">
            <span>Manage Music</span>
            <ArrowRight size={17} />
          </button>
        </article>

        <article className={`${styles.panel} ${styles.insightsPanel}`}>
          <header>
            <p>Journal Insights</p>
            <h2>Reflection Snapshot</h2>
          </header>
          <ul className={styles.insightList}>
            <li>You&apos;ve written {monthlyEntries} entries this month</li>
            <li>Most reflective day: {reflectiveDay}</li>
            <li>AI helped you {Math.max(0, entries.length * 2 + 1)} times</li>
          </ul>
          <button className={styles.pillButton} type="button">
            <span>View All Insights</span>
            <ArrowRight size={17} />
          </button>
        </article>
      </section>

      <form
        className={`${styles.panel} ${styles.settingsPanel}`}
        id="profile-settings"
        onSubmit={handleAccountSubmit}
      >
        <header>
          <p>Settings & Preferences</p>
          <h2>Personal controls</h2>
        </header>

        <div className={styles.settingsGroup}>
          <h3>
            <Paintbrush size={18} />
            Appearance
          </h3>
          <button className={styles.settingButton} onClick={onToggleTheme} type="button">
            <span>Theme: {darkMode ? "Dark" : "Light"} (Lavender accent)</span>
            <ArrowRight size={17} />
          </button>
          <span>Mood Color Style: Gradient</span>
        </div>

        <div className={styles.settingsGroup}>
          <h3>
            <Bell size={18} />
            Notifications
          </h3>
          <label>
            <input
              checked={isReminderEnabled}
              onChange={(event) => onReminderEnabled(event.target.checked)}
              type="checkbox"
            />
            Daily reminder at
          </label>
          <input
            disabled={!isReminderEnabled}
            onChange={(event) => onReminderTime(event.target.value)}
            type="time"
            value={reminderTime}
          />
          <span>Weekly AI summary</span>
        </div>

        <div className={styles.settingsGroup}>
          <h3>
            <ShieldCheck size={18} />
            Privacy & Data
          </h3>
          <button className={styles.settingButton} onClick={onExportEntries} type="button">
            <span>Export all my data (JSON + PDF)</span>
            <Download size={17} />
          </button>
          <button
            className={`${styles.settingButton} ${styles.dangerButton}`}
            onClick={onDeleteEntries}
            type="button"
          >
            <span>Delete all entries</span>
            <Trash2 size={17} />
          </button>
          <span>End-to-end encryption: ON</span>
        </div>

        <div className={styles.settingsGroup}>
          <h3>
            <Lock size={18} />
            Account
          </h3>
          <button
            className={styles.settingButton}
            onClick={() => setIsEditingProfile((current) => !current)}
            type="button"
          >
            <span>Edit Profile</span>
            <PenLine size={17} />
          </button>
          {isEditingProfile && (
            <div className={styles.formGrid}>
              <label>
                Display name
                <input
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  value={name}
                />
              </label>
              <label>
                Email address
                <input
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
              </label>
            </div>
          )}
          <button
            className={styles.settingButton}
            onClick={() => setIsChangingPassword((current) => !current)}
            type="button"
          >
            <span>Change Password</span>
            <Lock size={17} />
          </button>
          {isChangingPassword && (
            <div className={styles.passwordGrid}>
              <label>
                Current password
                <input
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Enter current password"
                  type="password"
                  value={currentPassword}
                />
              </label>
              <label>
                New password
                <input
                  autoComplete="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  type="password"
                  value={newPassword}
                />
              </label>
            </div>
          )}
          <button className={styles.settingButton} onClick={onLogout} type="button">
            <span>Log out</span>
            <LogOut size={17} />
          </button>
        </div>

        {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}
        {(isEditingProfile || isChangingPassword) && (
          <button className={styles.primaryButton} type="submit">
            <Mail size={17} />
            <span>Save changes</span>
          </button>
        )}
      </form>

      <footer className={styles.footer}>
        <span>Made with care ❤️</span>
        <span>Version 1.2.3</span>
      </footer>
    </section>
  );
}

function getInitials(value: string) {
  return (
    value
      .split(/[.\s@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "V"
  );
}

function isThisMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getEntriesThisMonth(entries: EntriesProps["entries"]) {
  return entries.filter((entry) => isThisMonth(entry.createdAt)).length;
}

function getAverage(entries: EntriesProps["entries"]) {
  if (entries.length === 0) return 0;
  return (
    Math.round((entries.reduce((total, entry) => total + entry.valence, 0) / entries.length) * 10) /
    10
  );
}

function getFavoriteTag(entries: EntriesProps["entries"]) {
  const counts = entries
    .flatMap((entry) => entry.tags)
    .reduce<Record<string, number>>((total, tag) => {
      total[tag] = (total[tag] ?? 0) + 1;
      return total;
    }, {});
  const [tag, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ["Grateful", 0];
  return { tag, count };
}

function getBestMonth(entries: EntriesProps["entries"]) {
  if (entries.length === 0) return "April (7.8)";
  const months = entries.reduce<Record<string, { count: number; total: number }>>(
    (total, entry) => {
      const key = new Intl.DateTimeFormat("en", { month: "long" }).format(
        new Date(entry.createdAt)
      );
      total[key] = total[key] ?? { count: 0, total: 0 };
      total[key].count += 1;
      total[key].total += entry.valence;
      return total;
    },
    {}
  );
  const [month, stats] = Object.entries(months).sort(
    (a, b) => b[1].total / b[1].count - a[1].total / a[1].count
  )[0];
  return `${month} (${Math.round((stats.total / stats.count) * 10) / 10})`;
}

function getMostReflectiveDay(entries: EntriesProps["entries"]) {
  if (entries.length === 0) return "Wednesday";
  const days = entries.reduce<Record<string, number>>((total, entry) => {
    const key = new Intl.DateTimeFormat("en", { weekday: "long" }).format(
      new Date(entry.createdAt)
    );
    total[key] = (total[key] ?? 0) + 1;
    return total;
  }, {});
  return Object.entries(days).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Wednesday";
}

function getSparklinePoints(entries: EntriesProps["entries"]) {
  const recent = entries.slice().reverse().slice(-30);
  const source = recent.length
    ? recent
    : [
        { valence: 5 },
        { valence: 6 },
        { valence: 5.5 },
        { valence: 7 },
        { valence: 6.9 },
        { valence: 7.8 },
      ];
  return source
    .map((entry, index) => {
      const x = source.length === 1 ? 150 : (300 / (source.length - 1)) * index;
      const y = 82 - (entry.valence / 10) * 68;
      return `${x},${y}`;
    })
    .join(" ");
}
