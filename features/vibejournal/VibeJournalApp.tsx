"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { buildInsight, getPlaylistSuggestion, moods, prompts, type MoodEntry, type MoodKey } from "@/lib/mood";
import type { ClientSettings, ClientUser } from "@/lib/api";
import type { InsightTab, Screen, UserSession } from "./types";
import { calculateStreak, deriveValence, filterEntries, getAverageMood } from "./utils";
import { AppChrome } from "./components/AppChrome/AppChrome";
import { AuthScreen } from "./screens/AuthScreen/AuthScreen";
import { HomeScreen } from "./screens/HomeScreen/HomeScreen";
import { InsightsScreen } from "./screens/InsightsScreen/InsightsScreen";
import { JournalScreen } from "./screens/JournalScreen/JournalScreen";
import { MusicScreen } from "./screens/MusicScreen/MusicScreen";
import { NewEntryScreen } from "./screens/NewEntryScreen/NewEntryScreen";
import { ProfileScreen } from "./screens/ProfileScreen/ProfileScreen";

const defaultSettings: ClientSettings = {
  darkMode: false,
  reminderEnabled: true,
  reminderTime: "20:30",
  spotifyConnected: false
};

export function VibeJournalApp() {
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [user, setUser] = useState<ClientUser | null>(null);
  const [settings, setSettings] = useState<ClientSettings>(defaultSettings);
  const [mood, setMood] = useState<MoodKey>("calm");
  const [energy, setEnergy] = useState(5);
  const [stress, setStress] = useState(4);
  const [sleepHours, setSleepHours] = useState(7);
  const [exerciseMinutes, setExerciseMinutes] = useState(20);
  const [socialLevel, setSocialLevel] = useState(5);
  const [note, setNote] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(["gratitude"]);
  const [customTag, setCustomTag] = useState("");
  const [query, setQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<"all" | MoodKey>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [insightTab, setInsightTab] = useState<InsightTab>("daily");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const activeEntries = useMemo(() => entries.filter((entry) => !entry.archivedAt), [entries]);
  const latestEntry = activeEntries[0] ?? null;
  const latestMood = moods.find((item) => item.key === (latestEntry?.mood ?? mood)) ?? moods[1];
  const insight = useMemo(() => buildInsight(activeEntries), [activeEntries]);
  const playlist = useMemo(() => getPlaylistSuggestion(latestEntry), [latestEntry]);
  const streak = useMemo(() => calculateStreak(activeEntries), [activeEntries]);
  const averageMood = useMemo(() => getAverageMood(activeEntries), [activeEntries]);
  const filteredEntries = useMemo(
    () => filterEntries(entries, query, moodFilter, tagFilter),
    [entries, moodFilter, query, tagFilter]
  );
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );

  useEffect(() => {
    function syncScreenFromHash() {
      const screen = parseScreenHash(window.location.hash);
      setActiveScreen(screen);
    }

    syncScreenFromHash();
    window.addEventListener("hashchange", syncScreenFromHash);

    return () => window.removeEventListener("hashchange", syncScreenFromHash);
  }, []);

  useEffect(() => {
    apiFetch<UserSession | { user: null }>("/api/auth/me")
      .then((session) => {
        if (session.user) {
          setUser(session.user);
          setEntries(session.entries);
          setSettings(session.settings);
        }
      })
      .finally(() => setIsLoadingSession(false));
  }, []);

  function navigateToScreen(screen: Screen) {
    setActiveScreen(screen);

    const nextHash = screen === "home" ? "" : `#${screen}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", `${window.location.pathname}${nextHash}`);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const allTags = [...selectedTags, customTag.trim().toLowerCase()].filter(Boolean);

    const entryPayload = {
      mood,
      energy,
      stress,
      valence: deriveValence(mood, stress),
      note: note.trim() || prompts[0],
      tags: Array.from(new Set(allTags)),
      sleepHours,
      exerciseMinutes,
      socialLevel,
      voiceNote: voiceNote.trim() || undefined,
      photoNames
    };

    setIsBusy(true);
    setStatusMessage("");

    try {
      const response = editingEntryId
        ? await apiFetch<{ entry: MoodEntry }>(`/api/entries/${editingEntryId}`, {
            method: "PATCH",
            body: JSON.stringify(entryPayload)
          })
        : await apiFetch<{ entry: MoodEntry }>("/api/entries", {
            method: "POST",
            body: JSON.stringify(entryPayload)
          });

      setEntries((current) =>
        editingEntryId
          ? current.map((entry) => entry.id === response.entry.id ? response.entry : entry)
          : [response.entry, ...current]
      );
      setEditingEntryId(null);
      setSelectedEntryId(response.entry.id);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not save entry.");
      return;
    } finally {
      setIsBusy(false);
    }

    setNote("");
    setVoiceNote("");
    setPhotoNames([]);
    setCustomTag("");
    setSelectedTags([]);
    navigateToScreen("home");
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  function editEntry(entry: MoodEntry) {
    setEditingEntryId(entry.id);
    setMood(entry.mood);
    setEnergy(entry.energy);
    setStress(entry.stress);
    setSleepHours(entry.sleepHours ?? 7);
    setExerciseMinutes(entry.exerciseMinutes ?? 20);
    setSocialLevel(entry.socialLevel ?? 5);
    setNote(entry.note);
    setVoiceNote(entry.voiceNote ?? "");
    setPhotoNames(entry.photoNames ?? []);
    setSelectedTags(entry.tags);
    setCustomTag("");
    navigateToScreen("new");
  }

  async function archiveEntry(entry: MoodEntry) {
    const response = await apiFetch<{ entry: MoodEntry }>(`/api/entries/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: !entry.archivedAt })
    });
    setEntries((current) => current.map((item) => item.id === response.entry.id ? response.entry : item));
  }

  async function deleteEntry(entryId: string) {
    if (!window.confirm("Delete this journal entry?")) {
      return;
    }

    await apiFetch(`/api/entries/${entryId}`, { method: "DELETE" });
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    setSelectedEntryId((current) => current === entryId ? null : current);
  }

  function exportEntries() {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vibejournal-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAllEntries() {
    if (window.confirm("Delete all VibeJournal entries from your account?")) {
      await apiFetch("/api/entries", { method: "DELETE" });
      setEntries([]);
    }
  }

  async function updateSettings(nextSettings: Partial<ClientSettings> & {
    currentPassword?: string;
    email?: string;
    name?: string;
    newPassword?: string;
  }) {
    const response = await apiFetch<{ user: ClientUser; settings: ClientSettings }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(nextSettings)
    });
    setUser(response.user);
    setSettings(response.settings);
  }

  async function updateAccount(payload: {
    currentPassword?: string;
    email?: string;
    name?: string;
    newPassword?: string;
  }) {
    setStatusMessage("");
    try {
      await updateSettings(payload);
      setStatusMessage("Account updated.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not update account.");
    }
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setEntries([]);
    setSettings(defaultSettings);
  }

  async function authenticate(path: string, payload: Record<string, string>) {
    setIsBusy(true);
    setAuthError("");
    setResetToken("");

    try {
      const response = await apiFetch<UserSession>(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setUser(response.user);
      setSettings(response.settings);
      setEntries(response.entries ?? []);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function requestPasswordReset(email: string) {
    setIsBusy(true);
    setAuthError("");

    try {
      const response = await apiFetch<{ ok: true; resetToken?: string }>("/api/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setResetToken(response.resetToken ?? "");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not start password reset.");
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmPasswordReset(token: string, password: string) {
    setIsBusy(true);
    setAuthError("");

    try {
      await apiFetch("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      setResetToken("");
      setAuthError("Password reset. You can log in now.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoadingSession) {
    return <main style={{ padding: 32 }}>Loading VibeJournal...</main>;
  }

  if (!user) {
    return (
      <AuthScreen
        error={authError}
        isBusy={isBusy}
        resetToken={resetToken}
        onLogin={(email, password) => authenticate("/api/auth/login", { email, password })}
        onPasswordReset={requestPasswordReset}
        onPasswordResetConfirm={confirmPasswordReset}
        onSignup={(name, email, password) => authenticate("/api/auth/signup", { name, email, password })}
      />
    );
  }

  return (
    <AppChrome
      activeScreen={activeScreen}
      darkMode={settings.darkMode}
      onNewEntry={() => navigateToScreen("new")}
      onScreenChange={navigateToScreen}
    >
      {activeScreen === "home" && (
        <HomeScreen
          entries={activeEntries}
          insight={insight}
          latestMood={latestMood}
          playlist={playlist}
          streak={streak}
          onNew={() => navigateToScreen("new")}
          onMusic={() => navigateToScreen("music")}
        />
      )}

      {activeScreen === "new" && (
        <NewEntryScreen
          customTag={customTag}
          energy={energy}
          exerciseMinutes={exerciseMinutes}
          isEditing={Boolean(editingEntryId)}
          mood={mood}
          note={note}
          photoNames={photoNames}
          selectedTags={selectedTags}
          sleepHours={sleepHours}
          socialLevel={socialLevel}
          stress={stress}
          voiceNote={voiceNote}
          onCustomTag={setCustomTag}
          onEnergy={setEnergy}
          onExerciseMinutes={setExerciseMinutes}
          onMood={setMood}
          onNote={setNote}
          onPhotoNames={setPhotoNames}
          onSave={handleSubmit}
          onSleepHours={setSleepHours}
          onSocialLevel={setSocialLevel}
          onStress={setStress}
          onToggleTag={toggleTag}
          onVoiceNote={setVoiceNote}
        />
      )}

      {activeScreen === "journal" && (
        <JournalScreen
          entries={filteredEntries}
          moodFilter={moodFilter}
          query={query}
          selectedEntry={selectedEntry}
          tagFilter={tagFilter}
          onArchiveEntry={archiveEntry}
          onDeleteEntry={deleteEntry}
          onEditEntry={editEntry}
          onMoodFilter={setMoodFilter}
          onQuery={setQuery}
          onSelectEntry={setSelectedEntryId}
          onTagFilter={setTagFilter}
        />
      )}

      {activeScreen === "insights" && (
        <InsightsScreen
          entries={activeEntries}
          insight={insight}
          tab={insightTab}
          onTab={setInsightTab}
        />
      )}

      {activeScreen === "music" && (
        <MusicScreen latestMood={latestMood} playlist={playlist} />
      )}

      {activeScreen === "profile" && (
        <ProfileScreen
          averageMood={averageMood}
          darkMode={settings.darkMode}
          entries={entries}
          isReminderEnabled={settings.reminderEnabled}
          reminderTime={settings.reminderTime}
          statusMessage={statusMessage}
          streak={streak}
          user={user}
          onAccountUpdate={updateAccount}
          onDeleteEntries={deleteAllEntries}
          onExportEntries={exportEntries}
          onLogout={logout}
          onReminderEnabled={(value) => updateSettings({ reminderEnabled: value })}
          onReminderTime={(value) => updateSettings({ reminderTime: value })}
          onToggleTheme={() => updateSettings({ darkMode: !settings.darkMode })}
        />
      )}
    </AppChrome>
  );
}

function parseScreenHash(hash: string): Screen {
  const screen = hash.replace("#", "");
  const screens: Screen[] = ["home", "new", "journal", "insights", "music", "profile"];

  return screens.includes(screen as Screen) ? (screen as Screen) : "home";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Request failed.");
  }

  return data as T;
}
