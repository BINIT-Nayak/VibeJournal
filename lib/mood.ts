export type MoodKey =
  | "joyful"
  | "calm"
  | "anxious"
  | "sad"
  | "angry"
  | "tired"
  | "hopeful"
  | "neutral";

export type MoodEntry = {
  id: string;
  mood: MoodKey;
  energy: number;
  stress: number;
  valence: number;
  note: string;
  tags: string[];
  sleepHours?: number;
  exerciseMinutes?: number;
  socialLevel?: number;
  voiceNote?: string;
  photoNames?: string[];
  archivedAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type PlaylistSuggestion = {
  title: string;
  description: string;
  query: string;
};

export const moods: Array<{
  key: MoodKey;
  label: string;
  symbol: string;
  color: string;
}> = [
  { key: "joyful", label: "Joyful", symbol: "😊", color: "#22C55E" },
  { key: "calm", label: "Calm", symbol: "😌", color: "#67E8F9" },
  { key: "anxious", label: "Anxious", symbol: "😟", color: "#F472B6" },
  { key: "sad", label: "Sad", symbol: "😢", color: "#E11D48" },
  { key: "angry", label: "Angry", symbol: "😤", color: "#E11D48" },
  { key: "tired", label: "Tired", symbol: "😴", color: "#94A3B8" },
  { key: "hopeful", label: "Hopeful", symbol: "🌤️", color: "#4ADE80" },
  { key: "neutral", label: "Neutral", symbol: "😐", color: "#94A3B8" },
];

export const prompts = [
  "What felt heavy today, and what made it a little easier?",
  "What is one small thing you are proud of today?",
  "What thought kept repeating, and is there another fair way to read it?",
  "What would you say to a friend who felt this way?",
  "What is one gentle next step you can take in the next hour?",
];

export function buildInsight(entries: MoodEntry[]) {
  if (entries.length === 0) {
    return {
      headline: "Your pattern will appear as you check in.",
      detail:
        "Start with one honest mood entry. VibeJournal will look for gentle trends without rushing to conclusions.",
      reframe: "A single entry is enough for today. Consistency can be tiny and still count.",
    };
  }

  const recent = entries.slice(0, 7);
  const lowEnergy = recent.filter((entry) => entry.energy <= 4).length;
  const avgValence = Math.round(
    recent.reduce((total, entry) => total + entry.valence, 0) / recent.length
  );
  const tagCounts = recent
    .flatMap((entry) => entry.tags)
    .reduce<Record<string, number>>((counts, tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1;
      return counts;
    }, {});
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const sleepEntries = recent.filter((entry) => typeof entry.sleepHours === "number");
  const avgSleep = sleepEntries.length
    ? Math.round(
        (sleepEntries.reduce((total, entry) => total + (entry.sleepHours ?? 0), 0) /
          sleepEntries.length) *
          10
      ) / 10
    : null;
  const activeDays = recent.filter((entry) => (entry.exerciseMinutes ?? 0) >= 20).length;
  const severeDistressPattern =
    /\b(suicide|kill myself|self harm|hurt myself|end it all|can't go on|cant go on)\b/i;
  const needsSafetyNet = recent.some((entry) =>
    severeDistressPattern.test(`${entry.note} ${entry.voiceNote ?? ""}`)
  );

  return {
    headline:
      lowEnergy >= 3
        ? `You have logged ${lowEnergy} low-energy check-ins recently.`
        : `Your recent mood average is ${avgValence}/10 on the valence scale.`,
    detail: topTag
      ? `"${topTag}" is showing up most often in your recent entries. It may be worth noticing what surrounds it.`
      : "No repeated trigger has stood out yet. A few more entries will make the pattern clearer.",
    reframe:
      "Try asking: what evidence supports this feeling, what evidence softens it, and what would be a kind next step?",
    context: avgSleep
      ? `Average sleep in recent check-ins is ${avgSleep}h. You also logged ${activeDays} movement-focused day${activeDays === 1 ? "" : "s"}.`
      : "Add sleep, movement, or social context to make the pattern view sharper.",
    safety: needsSafetyNet
      ? "This entry sounds heavy. If you might hurt yourself or feel unsafe, contact local emergency services or a crisis hotline now, and reach out to someone you trust."
      : null,
  };
}

export function getPlaylistSuggestion(entry: MoodEntry | null): PlaylistSuggestion {
  if (!entry) {
    return {
      title: "Soft Start Radio",
      description: "A neutral, low-pressure mix for getting started.",
      query: "calm focus gentle indie playlist",
    };
  }

  if (entry.valence <= 4 && entry.energy <= 4) {
    return {
      title: "Low Light Recovery",
      description: "Warm, steady songs for low energy without forcing cheer.",
      query: "gentle sad healing acoustic playlist",
    };
  }

  if (entry.valence <= 4 && entry.energy >= 7) {
    return {
      title: "Pressure Release",
      description: "Cathartic tracks for tension, anger, or anxious momentum.",
      query: "angry cathartic alternative rock playlist",
    };
  }

  if (entry.valence >= 7 && entry.energy >= 7) {
    return {
      title: "Bright Momentum",
      description: "Upbeat tracks to ride the good energy.",
      query: "happy upbeat pop dance playlist",
    };
  }

  if (entry.mood === "calm" || entry.energy <= 5) {
    return {
      title: "Quiet Anchor",
      description: "Soft textures for calm, focus, or winding down.",
      query: "calm ambient piano focus playlist",
    };
  }

  return {
    title: "Balanced Flow",
    description: "Mid-tempo songs for a stable, hopeful mood.",
    query: "hopeful indie pop mellow playlist",
  };
}
