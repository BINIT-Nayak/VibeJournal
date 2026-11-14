"use client";

import { NewJournalPage } from "./components/JournalPages/NewJournalPage";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPlaylistSuggestion,
  moods,
  type MoodEntry,
  type MoodKey,
} from "@/features/journal/mood";
import type { ClientSettings, ClientUser } from "@/features/auth/types";
import type { Screen, UserSession } from "@/features/journal/types";
import { calculateStreak, filterEntries, getAverageMood } from "@/features/journal/utils";
import type { JournalCreateInput } from "@/features/journal/schemas";
import type { JournalEntryDto } from "@/features/journal/api-types";
import { AppChrome } from "@/features/journal/components/AppChrome/AppChrome";

import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import type { DashboardResponse } from "@/features/dashboard/types";
import { AnalyticsScreen } from "@/features/analytics/AnalyticsScreen";
import { JournalScreen } from "@/features/journal/screens/JournalScreen/JournalScreen";
import { MusicScreen } from "@/features/journal/screens/MusicScreen/MusicScreen";
import { JournalEditor } from "@/features/journal/components/JournalEditor/JournalEditor";
import { ProfileScreen } from "@/features/journal/screens/ProfileScreen/ProfileScreen";

const defaultSettings: ClientSettings = {
  musicPreferences: {
    favoriteGenres: [],
    dislikedGenres: [],
    preferredLanguages: [],
    allowExplicit: false,
  },
  aiConsent: false,
  darkMode: false,
  privacyAcknowledged: false,
  reminderEnabled: true,
  reminderTime: "20:30",
  spotifyConnected: false,
};

export function VibeJournalApp() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [fullHistoryLoaded, setFullHistoryLoaded] = useState(false);
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [user, setUser] = useState<ClientUser | null>(null);
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState<ClientSettings>(defaultSettings);
  const [editingEntry, setEditingEntry] = useState<JournalEntryDto | null>(null);
  const [query, setQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<"all" | MoodKey>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [aiConsentSaving, setAiConsentSaving] = useState(false);
  const aiConsentPending = useRef(false);

  const activeEntries = useMemo(() => entries.filter((entry) => !entry.archivedAt), [entries]);
  const latestEntry = activeEntries[0] ?? null;
  const latestMood = moods.find((item) => item.key === (latestEntry?.mood ?? "calm")) ?? moods[1];
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
    window.addEventListener("popstate", syncScreenFromHash);

    return () => {
      window.removeEventListener("hashchange", syncScreenFromHash);
      window.removeEventListener("popstate", syncScreenFromHash);
    };
  }, []);

  useEffect(() => {
    apiFetch<DashboardResponse>(
      `/api/dashboard?timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
    )
      .then((session) => {
        if (session.user) {
          setUser(session.user);
          setDashboard(session);
          setEntries(session.recentEntries);
          setSettings(session.settings);
        } else {
          window.location.replace("/login");
        }
      })
      .catch(() => setStatusMessage("Could not load your session. Please reload."))
      .finally(() => setIsLoadingSession(false));
  }, []);

  useEffect(() => {
    if (!user || fullHistoryLoaded || activeScreen !== "profile") return;
    let cancelled = false;
    apiFetch<UserSession>("/api/auth/me")
      .then((session) => {
        if (!cancelled) {
          setEntries(session.entries);
          setFullHistoryLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setStatusMessage("Could not load journal history. Please reload.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeScreen, user, fullHistoryLoaded]);

  function navigateToScreen(screen: Screen) {
    if (screen === "music") {
      router.push("/music");
      return;
    }
    if (screen === "insights") {
      window.location.assign("/analytics");
      return;
    }
    if (screen === "journal") {
      window.location.assign("/journal");
      return;
    }
    setActiveScreen(screen);

    const nextHash = screen === "home" ? "" : `#${screen}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", `${window.location.pathname}${nextHash}`);
    }
  }

  function startEntry() {
    window.location.assign("/journal/new");
  }

  async function saveEntry(values: JournalCreateInput, baseVersion?: string) {
    const response = await apiFetch<{ entry: JournalEntryDto }>(
      editingEntry ? `/api/journal/${editingEntry.id}` : "/api/journal",
      {
        method: editingEntry ? "PATCH" : "POST",
        body: JSON.stringify({
          ...values,
          ...(editingEntry ? { expectedUpdatedAt: baseVersion ?? editingEntry.updatedAt } : {}),
        }),
      }
    );
    const entry: MoodEntry = {
      ...response.entry,
      sleepHours: response.entry.sleepHours ?? undefined,
    };
    setEntries((current) =>
      editingEntry
        ? current.map((item) => (item.id === entry.id ? entry : item))
        : [entry, ...current]
    );
    setSelectedEntryId(entry.id);
    setEditingEntry(null);
    navigateToScreen("journal");
  }

  async function editEntry(entry: MoodEntry) {
    try {
      const response = await apiFetch<{ entry: JournalEntryDto }>(`/api/journal/${entry.id}`);
      setEditingEntry(response.entry);
      navigateToScreen("new");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not load entry.");
    }
  }

  async function archiveEntry(entry: MoodEntry) {
    const response = await apiFetch<{ entry: MoodEntry }>(`/api/entries/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: !entry.archivedAt, expectedUpdatedAt: entry.updatedAt }),
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

  async function exportEntries() {
    if (!user) {
      return;
    }

    if (exporting) return;
    setExporting(true);
    setStatusMessage("Preparing your data download…");
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error?.message ?? "Your data export could not be downloaded.");
      }
      const blob = await response.blob();
      downloadBlob(blob, `vibejournal-data-${new Date().toISOString().slice(0, 10)}.json`);
      setStatusMessage(
        "Your data download is ready. Keep this file private; it contains your journal text."
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Download failed. Please try again."
      );
    } finally {
      setExporting(false);
    }
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

  async function updateAiConsent(value: boolean) {
    if (aiConsentPending.current) return;
    aiConsentPending.current = true;
    setAiConsentSaving(true);
    try {
      await updateProfileSetting(
        { aiConsent: value },
        value ? "AI analysis enabled for new entries." : "AI analysis disabled for future requests."
      );
    } finally {
      aiConsentPending.current = false;
      setAiConsentSaving(false);
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
      if (payload.newPassword) {
        window.location.assign("/login");
        return;
      }
      setStatusMessage("Account updated.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not update account.");
    }
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
    setUser(null);
    setEntries([]);
    setSettings(defaultSettings);
  }

  if (isLoadingSession) {
    return <main style={{ padding: 32 }}>Loading VibeJournal...</main>;
  }

  if (!user) {
    return (
      <main>
        <p role="alert">{statusMessage || "Please sign in to continue."}</p>
        {statusMessage && (
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        )}
        <a href="/login">Sign in</a>
      </main>
    );
  }

  return (
    <AppChrome
      activeScreen={activeScreen}
      darkMode={settings.darkMode}
      onNewEntry={startEntry}
      onScreenChange={navigateToScreen}
    >
      {activeScreen === "home" && dashboard ? <DashboardScreen data={dashboard} /> : null}

      {activeScreen === "new" && !editingEntry ? <NewJournalPage userId={user!.id} /> : null}
      {activeScreen === "new" && editingEntry ? (
        <JournalEditor
          userId={user!.id}
          entryId={editingEntry?.id}
          baseUpdatedAt={editingEntry?.updatedAt}
          key={`${user!.id}:${editingEntry?.id ?? "create"}`}
          mode={editingEntry ? "edit" : "create"}
          initialValues={
            editingEntry
              ? {
                  title: editingEntry.title,
                  content: editingEntry.content,
                  mood: editingEntry.mood,
                  moodScore: editingEntry.moodScore,
                  energyScore: editingEntry.energyScore,
                  sleepHours: editingEntry.sleepHours,
                  exercised: editingEntry.exercised,
                  socialScore: editingEntry.socialScore,
                  tags: editingEntry.tags,
                }
              : undefined
          }
          onSave={saveEntry}
          onCancel={() => {
            setEditingEntry(null);
            navigateToScreen("journal");
          }}
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

      {activeScreen === "profile" && !fullHistoryLoaded && (
        <p role="status">{statusMessage || "Loading your journal history…"}</p>
      )}

      {activeScreen === "insights" ? <AnalyticsScreen userId={user.id} /> : null}

      {activeScreen === "music" ? (
        <MusicScreen latestMood={latestMood} playlist={playlist} />
      ) : null}

      {activeScreen === "profile" && fullHistoryLoaded ? (
        <ProfileScreen
          averageMood={averageMood}
          aiConsent={settings.aiConsent}
          aiConsentSaving={aiConsentSaving}
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
          onAiConsent={updateAiConsent}
          onDeleteAccount={deleteAccount}
          onDeleteEntries={deleteAllEntries}
          onExportEntries={exportEntries}
          exporting={exporting}
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
    throw new Error(
      typeof data.error === "string" ? data.error : (data.error?.message ?? "Request failed.")
    );
  }

  return data as T;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
