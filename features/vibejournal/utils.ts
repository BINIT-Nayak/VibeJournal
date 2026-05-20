import type { MoodEntry, MoodKey } from "@/lib/mood";

export function deriveValence(mood: MoodKey, stress: number) {
  const base: Record<MoodKey, number> = {
    joyful: 9,
    calm: 7,
    anxious: 4,
    sad: 3,
    angry: 3,
    tired: 5,
    hopeful: 8,
    neutral: 6
  };

  return Math.max(1, Math.min(10, base[mood] - Math.floor(stress / 4)));
}

export function calculateStreak(entries: MoodEntry[]) {
  const days = new Set(entries.map((entry) => new Date(entry.createdAt).toDateString()));
  let streak = 0;
  const cursor = new Date();

  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function getAverageMood(entries: MoodEntry[]) {
  if (entries.length === 0) {
    return 0;
  }

  return Math.round(entries.reduce((total, entry) => total + entry.valence, 0) / entries.length);
}

export function filterEntries(
  entries: MoodEntry[],
  query: string,
  moodFilter: "all" | MoodKey,
  tagFilter: string
) {
  return entries.filter((entry) => {
    const matchesSearch = query.trim()
      ? `${entry.note} ${entry.tags.join(" ")} ${entry.mood}`.toLowerCase().includes(query.toLowerCase())
      : true;
    const matchesMood = moodFilter === "all" || entry.mood === moodFilter;
    const matchesTag = tagFilter === "all" || entry.tags.includes(tagFilter);

    return matchesSearch && matchesMood && matchesTag;
  });
}

export function navSymbol(screen: string) {
  const symbols: Record<string, string> = {
    home: "⌂",
    new: "+",
    journal: "□",
    insights: "◇",
    music: "♪",
    profile: "○"
  };

  return symbols[screen] ?? "○";
}
