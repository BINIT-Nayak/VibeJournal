"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  buildInsight,
  getPlaylistSuggestion,
  moods,
  prompts,
  type MoodEntry,
  type MoodKey,
} from "@/lib/mood";
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
  aiConsent: false,
  darkMode: false,
  privacyAcknowledged: false,
  reminderEnabled: true,
  reminderTime: "20:30",
  spotifyConnected: false,
};

const aiConsentRequiredInsight = {
  headline: "AI insights are off until you consent.",
  detail:
    "Your journal entries remain available for manual review. Enable AI consent in Profile when you want reflection prompts.",
  reframe: "VibeJournal should support reflection without pretending to diagnose or provide care.",
  context: "Privacy controls live in Profile.",
  safety:
    "If you might hurt yourself or feel unsafe, contact local emergency services or a crisis hotline now.",
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
  const insight = useMemo(
    () => (settings.aiConsent ? buildInsight(activeEntries) : aiConsentRequiredInsight),
    [activeEntries, settings.aiConsent]
  );
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

    const authErrorParam = new URLSearchParams(window.location.search).get("auth_error");
    if (authErrorParam) {
      setAuthError(authErrorParam);
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
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
      photoNames,
    };

    setIsBusy(true);
    setStatusMessage("");

    try {
      const response = editingEntryId
        ? await apiFetch<{ entry: MoodEntry }>(`/api/entries/${editingEntryId}`, {
            method: "PATCH",
            body: JSON.stringify(entryPayload),
          })
        : await apiFetch<{ entry: MoodEntry }>("/api/entries", {
            method: "POST",
            body: JSON.stringify(entryPayload),
          });

      setEntries((current) =>
        editingEntryId
          ? current.map((entry) => (entry.id === response.entry.id ? response.entry : entry))
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
      body: JSON.stringify({ archived: !entry.archivedAt }),
    });
    setEntries((current) =>
      current.map((item) => (item.id === response.entry.id ? response.entry : item))
    );
  }

  async function deleteEntry(entryId: string) {
    if (!window.confirm("Delete this journal entry?")) {
      return;
    }

    await apiFetch(`/api/entries/${entryId}`, { method: "DELETE" });
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    setSelectedEntryId((current) => (current === entryId ? null : current));
  }

  function exportEntries() {
    if (!user) {
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      profile: user,
      settings,
      version: 1,
      entries,
    };
    const date = new Date().toISOString().slice(0, 10);

    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
      `vibejournal-export-${date}.json`
    );
    downloadBlob(createExportPdf(payload), `vibejournal-export-${date}.pdf`);
    setStatusMessage("Export downloaded as JSON and PDF.");
  }

  async function deleteAllEntries() {
    const confirmed = window.confirm(
      "Delete all journal entries from this account? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      await apiFetch("/api/entries", { method: "DELETE" });
      setEntries([]);
      setStatusMessage("All journal entries were deleted.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not delete entries.");
    }
  }

  async function deleteAccount() {
    const firstConfirmation = window.confirm(
      "Delete your VibeJournal account, settings, sessions, and all entries? This cannot be undone."
    );

    if (!firstConfirmation) {
      return;
    }

    const typedConfirmation = window.prompt('Type "DELETE" to permanently delete your account.');
    if (typedConfirmation !== "DELETE") {
      setStatusMessage("Account deletion cancelled.");
      return;
    }

    try {
      await apiFetch("/api/account", { method: "DELETE" });
      setUser(null);
      setEntries([]);
      setSettings(defaultSettings);
      setStatusMessage("");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not delete account.");
    }
  }

  async function updateSettings(
    nextSettings: Partial<ClientSettings> & {
      currentPassword?: string;
      email?: string;
      name?: string;
      newPassword?: string;
    }
  ) {
    const response = await apiFetch<{
      user: ClientUser;
      settings: ClientSettings;
    }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(nextSettings),
    });
    setUser(response.user);
    setSettings(response.settings);
  }

  async function updateProfileSetting(nextSettings: Partial<ClientSettings>, message: string) {
    setStatusMessage("");
    try {
      await updateSettings(nextSettings);
      setStatusMessage(message);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not update settings.");
    }
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
        body: JSON.stringify(payload),
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
      const response = await apiFetch<{ ok: true; resetToken?: string }>(
        "/api/auth/password-reset/request",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        }
      );
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
        body: JSON.stringify({ token, password }),
      });
      setResetToken("");
      setAuthError("Password reset. You can log in now.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setIsBusy(false);
    }
  }

  function startGoogleLogin() {
    window.location.href = "/api/auth/google";
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
        onGoogleLogin={startGoogleLogin}
        onLogin={(email, password) => authenticate("/api/auth/login", { email, password })}
        onPasswordReset={requestPasswordReset}
        onPasswordResetConfirm={confirmPasswordReset}
        onSignup={(name, email, password) =>
          authenticate("/api/auth/signup", { name, email, password })
        }
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
      {activeScreen === "home" ? (
        <HomeScreen
          entries={activeEntries}
          insight={insight}
          latestMood={latestMood}
          playlist={playlist}
          streak={streak}
          userName={user.name}
          onInsights={() => navigateToScreen("insights")}
          onJournal={() => navigateToScreen("journal")}
          onNew={() => navigateToScreen("new")}
          onMusic={() => navigateToScreen("music")}
        />
      ) : null}

      {activeScreen === "new" ? (
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
      ) : null}

      {activeScreen === "journal" ? (
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
      ) : null}

      {activeScreen === "insights" ? (
        <InsightsScreen
          entries={activeEntries}
          insight={insight}
          tab={insightTab}
          onTab={setInsightTab}
        />
      ) : null}

      {activeScreen === "music" ? (
        <MusicScreen latestMood={latestMood} playlist={playlist} />
      ) : null}

      {activeScreen === "profile" ? (
        <ProfileScreen
          averageMood={averageMood}
          aiConsent={settings.aiConsent}
          darkMode={settings.darkMode}
          entries={entries}
          isReminderEnabled={settings.reminderEnabled}
          privacyAcknowledged={settings.privacyAcknowledged}
          reminderTime={settings.reminderTime}
          spotifyConnected={settings.spotifyConnected}
          statusMessage={statusMessage}
          streak={streak}
          user={user}
          onAccountUpdate={updateAccount}
          onAiConsent={(value) =>
            updateProfileSetting(
              { aiConsent: value },
              value ? "AI insight consent enabled." : "AI insight consent disabled."
            )
          }
          onDeleteAccount={deleteAccount}
          onDeleteEntries={deleteAllEntries}
          onExportEntries={exportEntries}
          onLogout={logout}
          onPrivacyAcknowledged={() =>
            updateProfileSetting(
              { privacyAcknowledged: true },
              "Privacy and safety notes acknowledged."
            )
          }
          onReminderEnabled={(value) => updateSettings({ reminderEnabled: value })}
          onReminderTime={(value) => updateSettings({ reminderTime: value })}
          onSpotifyConnection={() =>
            updateProfileSetting(
              { spotifyConnected: !settings.spotifyConnected },
              settings.spotifyConnected
                ? "Spotify preference disconnected."
                : "Spotify preference saved. OAuth connection can be added later."
            )
          }
          onToggleTheme={() => updateSettings({ darkMode: !settings.darkMode })}
        />
      ) : null}
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
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Request failed.");
  }

  return data as T;
}

function createExportPdf(payload: {
  entries: MoodEntry[];
  exportedAt: string;
  profile: ClientUser;
  settings: ClientSettings;
  version: number;
}) {
  const lines = [
    "VibeJournal Data Export",
    `Exported: ${payload.exportedAt}`,
    `Account: ${payload.profile.email}`,
    `Entries: ${payload.entries.length}`,
    `AI consent: ${payload.settings.aiConsent ? "On" : "Off"}`,
    `Privacy acknowledged: ${payload.settings.privacyAcknowledged ? "Yes" : "No"}`,
    "",
    "This export is for personal review. VibeJournal is not a medical device and does not diagnose, treat, or replace professional care.",
    "",
    ...payload.entries
      .slice(0, 24)
      .flatMap((entry, index) => [
        `${index + 1}. ${new Date(entry.createdAt).toLocaleString()} - ${entry.mood} - ${entry.valence}/10`,
        `Tags: ${entry.tags.join(", ") || "none"}`,
        `Note: ${entry.note.slice(0, 180)}`,
        "",
      ]),
  ];
  const pageText = lines
    .map((line, index) => `BT /F1 10 Tf 48 ${760 - index * 16} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${pageText.length} >> stream\n${pageText}\nendstream endobj`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object) => {
    const offset = pdf.length;
    pdf += `${object}\n`;
    return offset;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
