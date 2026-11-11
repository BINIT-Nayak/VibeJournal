"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildInsight,
  getPlaylistSuggestion,
  moods,
  type MoodEntry,
  type MoodKey,
} from "@/features/journal/mood";
import type { ClientSettings, ClientUser } from "@/features/auth/types";
import type { InsightTab, Screen, UserSession } from "@/features/journal/types";
import { calculateStreak, filterEntries, getAverageMood } from "@/features/journal/utils";
import type { JournalCreateInput } from "@/features/journal/schemas";
import type { JournalEntryDto } from "@/features/journal/api-types";
import { AppChrome } from "@/features/journal/components/AppChrome/AppChrome";

import { HomeScreen } from "@/features/journal/screens/HomeScreen/HomeScreen";
import { InsightsScreen } from "@/features/journal/screens/InsightsScreen/InsightsScreen";
import { JournalScreen } from "@/features/journal/screens/JournalScreen/JournalScreen";
import { MusicScreen } from "@/features/journal/screens/MusicScreen/MusicScreen";
import { JournalEditor } from "@/features/journal/components/JournalEditor/JournalEditor";
import { ProfileScreen } from "@/features/journal/screens/ProfileScreen/ProfileScreen";

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
  const [editingEntry, setEditingEntry] = useState<JournalEntryDto | null>(null);
  const [query, setQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<"all" | MoodKey>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [insightTab, setInsightTab] = useState<InsightTab>("daily");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const activeEntries = useMemo(() => entries.filter((entry) => !entry.archivedAt), [entries]);
  const latestEntry = activeEntries[0] ?? null;
  const latestMood = moods.find((item) => item.key === (latestEntry?.mood ?? "calm")) ?? moods[1];
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

    syncScreenFromHash();
    window.addEventListener("hashchange", syncScreenFromHash);
    window.addEventListener("popstate", syncScreenFromHash);

    return () => {
      window.removeEventListener("hashchange", syncScreenFromHash);
      window.removeEventListener("popstate", syncScreenFromHash);
    };
  }, []);

  useEffect(() => {
    apiFetch<UserSession | { user: null }>("/api/auth/me")
      .then((session) => {
        if (session.user) {
          setUser(session.user);
          setEntries(session.entries);
          setSettings(session.settings);
        } else {
          window.location.replace("/login");
        }
      })
      .catch(() => setStatusMessage("Could not load your session. Please reload."))
      .finally(() => setIsLoadingSession(false));
  }, []);

  function navigateToScreen(screen: Screen) {
    setActiveScreen(screen);

    const nextHash = screen === "home" ? "" : `#${screen}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", `${window.location.pathname}${nextHash}`);
    }
  }

  function startEntry() {
    setEditingEntry(null);
    navigateToScreen("new");
  }

  async function saveEntry(values: JournalCreateInput) {
    const response = await apiFetch<{ entry: JournalEntryDto }>(
      editingEntry ? `/api/journal/${editingEntry.id}` : "/api/journal",
      { method: editingEntry ? "PATCH" : "POST", body: JSON.stringify(values) }
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
        <p>{statusMessage || "Please sign in to continue."}</p>
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
          onNew={startEntry}
          onMusic={() => navigateToScreen("music")}
        />
      ) : null}

      {activeScreen === "new" ? (
        <JournalEditor
          key={editingEntry?.id ?? "create"}
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
    throw new Error(
      typeof data.error === "string" ? data.error : (data.error?.message ?? "Request failed.")
    );
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
