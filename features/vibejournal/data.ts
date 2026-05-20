import type { MoodEntry } from "@/lib/mood";

export const journalTags = [
  "work",
  "sleep",
  "gratitude",
  "family",
  "focus",
  "health",
  "stress",
  "walk"
];

export const reflectionPrompts = [
  "What made me smile?",
  "What drained me?",
  "What do I need?",
  "What can I release?"
];

export const moodStations = ["Anxious", "Focused", "Grateful", "Sleepy", "Brave", "Unwind"];

function daysAgo(days: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
}

export const starterEntries: MoodEntry[] = [
  {
    id: "sample-1",
    mood: "calm",
    energy: 5,
    stress: 3,
    valence: 7,
    note: "Slow morning, but I felt grounded after walking.",
    tags: ["walk", "gratitude"],
    createdAt: daysAgo(0, 8)
  },
  {
    id: "sample-2",
    mood: "anxious",
    energy: 8,
    stress: 8,
    valence: 4,
    note: "Work messages kept stacking up. I paused before replying.",
    tags: ["work", "stress"],
    createdAt: daysAgo(1, 18)
  },
  {
    id: "sample-3",
    mood: "hopeful",
    energy: 6,
    stress: 4,
    valence: 8,
    note: "A small win in the afternoon changed the tone of the day.",
    tags: ["work", "gratitude"],
    createdAt: daysAgo(2, 16)
  },
  {
    id: "sample-4",
    mood: "tired",
    energy: 3,
    stress: 5,
    valence: 5,
    note: "Sleep was short, so I kept expectations realistic.",
    tags: ["sleep", "health"],
    createdAt: daysAgo(4, 10)
  },
  {
    id: "sample-5",
    mood: "joyful",
    energy: 8,
    stress: 2,
    valence: 9,
    note: "Dinner with family felt easy and warm.",
    tags: ["family", "gratitude"],
    createdAt: daysAgo(6, 21)
  }
];
