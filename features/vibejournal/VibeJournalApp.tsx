"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { buildInsight, getPlaylistSuggestion, moods, prompts, type MoodEntry, type MoodKey } from "@/lib/mood";
import { starterEntries } from "./data";
import type { InsightTab, Screen } from "./types";
import { calculateStreak, deriveValence, filterEntries, getAverageMood } from "./utils";
import { AppChrome } from "./components/AppChrome/AppChrome";
import { HomeScreen } from "./screens/HomeScreen/HomeScreen";
import { InsightsScreen } from "./screens/InsightsScreen/InsightsScreen";
import { JournalScreen } from "./screens/JournalScreen/JournalScreen";
import { MusicScreen } from "./screens/MusicScreen/MusicScreen";
import { NewEntryScreen } from "./screens/NewEntryScreen/NewEntryScreen";
import { ProfileScreen } from "./screens/ProfileScreen/ProfileScreen";

export function VibeJournalApp() {
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  const [entries, setEntries] = useState<MoodEntry[]>(starterEntries);
  const [mood, setMood] = useState<MoodKey>("calm");
  const [energy, setEnergy] = useState(5);
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["gratitude"]);
  const [customTag, setCustomTag] = useState("");
  const [query, setQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<"all" | MoodKey>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [insightTab, setInsightTab] = useState<InsightTab>("daily");
  const [darkMode, setDarkMode] = useState(false);

  const latestEntry = entries[0] ?? null;
  const latestMood = moods.find((item) => item.key === (latestEntry?.mood ?? mood)) ?? moods[1];
  const insight = useMemo(() => buildInsight(entries), [entries]);
  const playlist = useMemo(() => getPlaylistSuggestion(latestEntry), [latestEntry]);
  const streak = useMemo(() => calculateStreak(entries), [entries]);
  const averageMood = useMemo(() => getAverageMood(entries), [entries]);
  const filteredEntries = useMemo(
    () => filterEntries(entries, query, moodFilter, tagFilter),
    [entries, moodFilter, query, tagFilter]
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

  function navigateToScreen(screen: Screen) {
    setActiveScreen(screen);

    const nextHash = screen === "home" ? "" : `#${screen}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", `${window.location.pathname}${nextHash}`);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const allTags = [...selectedTags, customTag.trim().toLowerCase()].filter(Boolean);

    const nextEntry: MoodEntry = {
      id: crypto.randomUUID(),
      mood,
      energy,
      stress,
      valence: deriveValence(mood, stress),
      note: note.trim() || prompts[0],
      tags: Array.from(new Set(allTags)),
      createdAt: new Date().toISOString()
    };

    setEntries((current) => [nextEntry, ...current]);
    setNote("");
    setCustomTag("");
    setSelectedTags([]);
    navigateToScreen("home");
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  return (
    <AppChrome
      activeScreen={activeScreen}
      darkMode={darkMode}
      onNewEntry={() => navigateToScreen("new")}
      onScreenChange={navigateToScreen}
    >
      {activeScreen === "home" && (
        <HomeScreen
          entries={entries}
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
          mood={mood}
          note={note}
          selectedTags={selectedTags}
          stress={stress}
          onCustomTag={setCustomTag}
          onEnergy={setEnergy}
          onMood={setMood}
          onNote={setNote}
          onSave={handleSubmit}
          onStress={setStress}
          onToggleTag={toggleTag}
        />
      )}

      {activeScreen === "journal" && (
        <JournalScreen
          entries={filteredEntries}
          moodFilter={moodFilter}
          query={query}
          tagFilter={tagFilter}
          onMoodFilter={setMoodFilter}
          onQuery={setQuery}
          onTagFilter={setTagFilter}
        />
      )}

      {activeScreen === "insights" && (
        <InsightsScreen
          entries={entries}
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
          darkMode={darkMode}
          entries={entries}
          streak={streak}
          onToggleTheme={() => setDarkMode((current) => !current)}
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
