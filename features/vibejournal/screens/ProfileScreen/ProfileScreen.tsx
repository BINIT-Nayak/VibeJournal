import { type FormEvent, useState } from "react";
import type { ClientUser } from "@/lib/api";
import { PageTitle } from "../../components/SectionTitle/SectionTitle";
import { StatCard } from "../../components/StatCard/StatCard";
import type { EntriesProps } from "../../types";
import styles from "./ProfileScreen.module.css";

type ProfileScreenProps = EntriesProps & {
  averageMood: number;
  darkMode: boolean;
  isReminderEnabled: boolean;
  onAccountUpdate: (payload: { currentPassword?: string; email?: string; name?: string; newPassword?: string }) => void;
  onDeleteEntries: () => void;
  onExportEntries: () => void;
  onLogout: () => void;
  onReminderEnabled: (value: boolean) => void;
  onReminderTime: (value: string) => void;
  onToggleTheme: () => void;
  reminderTime: string;
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
  statusMessage,
  streak,
  user
}: ProfileScreenProps) {
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAccountUpdate({
      name,
      email,
      currentPassword: currentPassword || undefined,
      newPassword: newPassword || undefined
    });
    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <section className={styles.screen}>
      <PageTitle eyebrow="Profile" title="Your space" />

      <section className={styles.profileHero}>
        <div className={styles.avatar}>{getInitials(name || email)}</div>
        <div>
          <p>Signed in as</p>
          <h2>{name || "VibeJournal user"}</h2>
          <span>{email}</span>
        </div>
        <button onClick={onLogout} type="button">Logout</button>
      </section>

      <div className={styles.statsGrid}>
        <StatCard label="Average mood" value={`${averageMood}/10`} />
        <StatCard label="Best day" value="Friday" />
        <StatCard label="Entries" value={String(entries.length)} />
        <StatCard label="Streak" value={`${streak} days`} />
      </div>

      <div className={styles.profileGrid}>
        <form className={styles.glassPanel} onSubmit={handleAccountSubmit}>
          <header>
            <p>Account</p>
            <h3>Identity & password</h3>
          </header>
          <div className={styles.formGrid}>
            <label>
              Name
              <input onChange={(event) => setName(event.target.value)} value={name} />
            </label>
            <label>
              Email
              <input onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
            </label>
            <label>
              Current password
              <input onChange={(event) => setCurrentPassword(event.target.value)} type="password" value={currentPassword} />
            </label>
            <label>
              New password
              <input onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} />
            </label>
          </div>
          {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}
          <button className={styles.primaryButton} type="submit">Save account settings</button>
        </form>

        <section className={styles.glassPanel}>
          <header>
            <p>Preferences</p>
            <h3>Daily rhythm</h3>
          </header>
          <div className={styles.preferenceStack}>
            <div className={styles.settingRow}>
              <span>Reminder</span>
              <label>
                <input
                  checked={isReminderEnabled}
                  onChange={(event) => onReminderEnabled(event.target.checked)}
                  type="checkbox"
                />
                Enabled
              </label>
              <input
                disabled={!isReminderEnabled}
                onChange={(event) => onReminderTime(event.target.value)}
                type="time"
                value={reminderTime}
              />
            </div>
            <button onClick={onToggleTheme} type="button">Theme: {darkMode ? "Dark" : "Light"}</button>
            <button type="button">Spotify: Not connected</button>
          </div>
        </section>

        <section className={styles.glassPanel}>
          <header>
            <p>Privacy</p>
            <h3>Data controls</h3>
          </header>
          <div className={styles.privacyCard}>
            <strong>Saved to your account database</strong>
            <span>Your entries are scoped to your login session and protected API routes.</span>
          </div>
          <div className={styles.actionGrid}>
            <button onClick={onExportEntries} type="button">Export my data</button>
            <button className={styles.dangerButton} onClick={onDeleteEntries} type="button">Delete all entries</button>
          </div>
        </section>
      </div>
    </section>
  );
}

function getInitials(value: string) {
  return value
    .split(/[.\s@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "V";
}
