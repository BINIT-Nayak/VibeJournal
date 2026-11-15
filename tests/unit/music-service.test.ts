import { describe, expect, it } from "vitest";
import { recommendMusicCriteria } from "@/features/music/recommendation-service";
const context = {
  mood: 3,
  energy: 3,
  primaryEmotion: "sad",
  intent: "match",
  timeOfDay: "afternoon",
};
describe("provider-neutral listening recommendations", () => {
  it("uplifts low mood without demanding maximum energy", () => {
    const match = recommendMusicCriteria(context);
    const uplift = recommendMusicCriteria({ ...context, intent: "uplift" });
    expect(uplift.positivity.target).toBeGreaterThan(match.positivity.target);
    expect(uplift.intensity.target).toBeLessThan(0.7);
  });
  it("reduces intensity when an energetic listener asks to calm down", () => {
    const match = recommendMusicCriteria({ ...context, energy: 10 });
    const calm = recommendMusicCriteria({ ...context, energy: 10, intent: "calm" });
    expect(calm.intensity.target).toBeLessThan(match.intensity.target);
  });
  it.each(["match", "uplift", "calm", "focus"])(
    "keeps %s targets inside their public normalized range",
    (intent) => {
      const result = recommendMusicCriteria({ ...context, intent });
      for (const range of [result.intensity, result.positivity]) {
        expect(range.min).toBeGreaterThanOrEqual(0);
        expect(range.max).toBeLessThanOrEqual(1);
        expect(range.target).toBeGreaterThanOrEqual(range.min);
        expect(range.target).toBeLessThanOrEqual(range.max);
      }
    }
  );
  it("rejects contradictory genre preferences", () => {
    expect(() =>
      recommendMusicCriteria(context, {
        favoriteGenres: ["jazz"],
        dislikedGenres: ["jazz"],
        preferredLanguages: [],
        allowExplicit: false,
      })
    ).toThrow();
  });
});
