import { z } from "zod";

export const musicGenres = [
  "pop",
  "rock",
  "hip-hop",
  "r&b",
  "jazz",
  "classical",
  "electronic",
  "ambient",
  "folk",
  "country",
  "metal",
  "reggae",
  "soundtrack",
  "world",
] as const;
export const musicLanguages = [
  "english",
  "hindi",
  "tamil",
  "telugu",
  "spanish",
  "french",
  "japanese",
  "korean",
  "portuguese",
  "punjabi",
] as const;
const genres = z
  .array(z.enum(musicGenres))
  .max(5)
  .refine((values) => new Set(values).size === values.length, "Choose each genre only once.");
export const musicPreferencesSchema = z
  .strictObject({
    favoriteGenres: genres,
    dislikedGenres: genres,
    preferredLanguages: z
      .array(z.enum(musicLanguages))
      .max(3)
      .refine(
        (values) => new Set(values).size === values.length,
        "Choose each language only once."
      ),
    allowExplicit: z.boolean(),
  })
  .refine((value) => !value.favoriteGenres.some((genre) => value.dislikedGenres.includes(genre)), {
    message: "A genre cannot be both a favorite and disliked.",
    path: ["dislikedGenres"],
  });
export type MusicPreferences = z.infer<typeof musicPreferencesSchema>;
export const defaultMusicPreferences: MusicPreferences = {
  favoriteGenres: [],
  dislikedGenres: [],
  preferredLanguages: [],
  allowExplicit: false,
};
