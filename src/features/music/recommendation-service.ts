import { defaultMusicPreferences, musicPreferencesSchema } from "./preferences";
import {
  musicContextSchema,
  musicCriteriaSchema,
  type MusicCriteria,
  type MusicEmotion,
  type MusicTimeOfDay,
} from "./schemas";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 1000) / 1000;
const unitRange = (target: number, width: number) => ({
  min: round(clamp(target - width, 0, 1)),
  target: round(target),
  max: round(clamp(target + width, 0, 1)),
});
type Descriptor = MusicCriteria["descriptors"][number];
const emotionDescriptors: Record<MusicEmotion, Descriptor> = {
  joyful: "bright",
  calm: "spacious",
  anxious: "gentle",
  sad: "reflective",
  angry: "expressive",
  tired: "soft",
  hopeful: "warm",
  neutral: "steady",
  grateful: "warm",
  lonely: "warm",
  overwhelmed: "gentle",
  frustrated: "expressive",
  excited: "bright",
  content: "steady",
};

/** Caller supplies the listener's local hour; this engine never reads a clock. */
export function getMusicTimeOfDay(localHour: number): MusicTimeOfDay {
  if (!Number.isInteger(localHour) || localHour < 0 || localHour > 23)
    throw new RangeError("Local hour must be an integer from 0 to 23.");
  if (localHour >= 5 && localHour < 12) return "morning";
  if (localHour >= 12 && localHour < 17) return "afternoon";
  if (localHour >= 17 && localHour < 22) return "evening";
  return "night";
}

/**
 * Pure domain policy: no API calls, credentials, journal text, or vendor parameters.
 * An emotion is only a soft descriptor; the user's selected intent takes precedence.
 */
export function recommendMusicCriteria(
  input: unknown,
  preferencesInput: unknown = defaultMusicPreferences
): MusicCriteria {
  const constraints = musicPreferencesSchema.parse(preferencesInput);
  const context = musicContextSchema.parse(input);
  const mood = (context.mood - 1) / 9;
  const energy = (context.energy - 1) / 9;
  let positivity = mood;
  let intensity = energy;
  let tempo: number;
  let descriptors: Descriptor[];
  let vocals: MusicCriteria["vocals"] = "any";
  let explanation: string;

  switch (context.intent) {
    case "match":
      tempo = Math.round(55 + energy * 110);
      descriptors = [
        context.primaryEmotion ? emotionDescriptors[context.primaryEmotion] : "steady",
        mood < 0.4 ? "reflective" : mood > 0.65 ? "bright" : "warm",
      ];
      explanation =
        "Matches your recorded mood and energy, with the emotion label used only as a soft musical cue.";
      break;
    case "uplift":
      positivity = clamp(mood + 0.2, 0.6, 1);
      // Lift gradually: low reported energy should not force a high-intensity mix.
      intensity = clamp(
        energy +
          {
            morning: 0.2,
            afternoon: 0.15,
            evening: 0.1,
            night: 0.05,
          }[context.timeOfDay],
        0.3,
        1
      );
      tempo = Math.round(75 + intensity * 65);
      descriptors = [
        "bright",
        "warm",
        energy < 0.4 ||
        ["anxious", "overwhelmed", "tired", "lonely"].includes(context.primaryEmotion ?? "")
          ? "gentle"
          : "steady",
      ];
      explanation =
        "Leans toward brighter music with a gradual energy lift. This is a listening preference, not a promise to change how you feel.";
      break;
    case "calm":
      positivity = clamp(mood, 0.4, 0.65);
      intensity = Math.min(energy, 0.25);
      tempo = Math.round(55 + intensity * 60);
      vocals = "prefer_instrumental";
      descriptors = ["soft", "spacious", "gentle"];
      explanation =
        "Prioritizes soft, spacious music and a slower pace, even when your recorded energy is high.";
      break;
    case "focus":
      positivity = clamp(mood, 0.4, 0.65);
      intensity = clamp(energy, 0.3, 0.5);
      tempo = Math.round(75 + intensity * 40);
      vocals = "prefer_instrumental";
      descriptors = ["steady", "minimal", "low_distraction"];
      explanation =
        "Prioritizes a steady pace and fewer vocal distractions. Focus is your chosen listening direction, not a guaranteed outcome.";
      break;
  }
  // Time modifies pace softly; it cannot turn calm/focus into a high-energy request.
  if (context.timeOfDay === "night") {
    tempo -= context.intent === "uplift" ? 10 : 5;
    if (context.intent === "calm" || context.intent === "focus")
      intensity = Math.max(0, intensity - 0.05);
    descriptors.push("soft");
    explanation += " Night listening uses a softer, slower direction.";
  } else if (context.timeOfDay === "evening") {
    tempo -= 4;
    descriptors.push("warm");
    explanation += " Evening listening uses a slightly slower pace.";
  } else if (context.timeOfDay === "morning" && context.intent === "uplift") {
    tempo += 5;
    explanation += " Morning uplift adds a little more momentum.";
  }
  tempo = clamp(tempo, 40, 200);
  return musicCriteriaSchema.parse({
    constraints,
    intent: context.intent,
    timeOfDay: context.timeOfDay,
    positivity: unitRange(positivity, 0.12),
    intensity: unitRange(intensity, context.intent === "calm" ? 0.08 : 0.1),
    tempoBpm: { min: Math.max(40, tempo - 10), target: tempo, max: Math.min(200, tempo + 10) },
    vocals,
    descriptors: [...new Set(descriptors)],
    explanation,
  });
}
