import "server-only";
import { z } from "zod";
import { musicCriteriaSchema } from "../../features/music/schemas";
import type { MusicPreferences } from "../../features/music/preferences";
import { MusicProviderError, type MusicProvider } from "./provider";

const trackSchema = z.object({
  kind: z.literal("song"),
  trackId: z.number().int().positive(),
  trackName: z.string().min(1).max(500),
  artistName: z.string().min(1).max(500),
  primaryGenreName: z.string().max(100).optional(),
  trackExplicitness: z.enum(["explicit", "cleaned", "notExplicit"]).optional(),
  trackViewUrl: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" && ["music.apple.com", "itunes.apple.com"].includes(url.hostname)
    );
  }),
});
type Genre = MusicPreferences["favoriteGenres"][number];
const genrePatterns: Record<Genre, RegExp> = {
  pop: /pop/i,
  rock: /rock|alternative|punk|grunge/i,
  "hip-hop": /hip.?hop|rap/i,
  "r&b": /r&b|soul|rhythm.*blues/i,
  jazz: /jazz/i,
  classical: /classical|opera|orchestral/i,
  electronic: /electronic|electronica|dance|house|techno|trance/i,
  ambient: /ambient|new age|meditation/i,
  folk: /folk|singer.songwriter/i,
  country: /country|bluegrass/i,
  metal: /metal/i,
  reggae: /reggae|ska/i,
  soundtrack: /soundtrack|score/i,
  world: /world|indian|bollywood|tamil|telugu|punjabi|latin|african/i,
};
export function catalogGenres(label: string | undefined): Genre[] {
  return label
    ? (Object.keys(genrePatterns) as Genre[]).filter((genre) => genrePatterns[genre].test(label))
    : [];
}
export function createItunesProvider(fetcher: typeof fetch = fetch): MusicProvider {
  return {
    async recommend(input, signal) {
      const criteria = musicCriteriaSchema.parse(input);
      const preferences = criteria.constraints;
      const base =
        criteria.intent === "focus"
          ? "instrumental focus"
          : criteria.intent === "calm"
            ? "ambient piano"
            : criteria.intent === "uplift"
              ? criteria.intensity.target < 0.5
                ? "acoustic uplifting"
                : "upbeat pop"
              : criteria.positivity.target < 0.4
                ? "mellow acoustic"
                : criteria.intensity.target > 0.65
                  ? "dance pop"
                  : "indie mellow";
      // At most three bounded searches; language terms are hints, never verified labels.
      const languages = preferences.preferredLanguages.length
        ? preferences.preferredLanguages
        : [""];
      const queries = languages.map((language, index) => {
        const genre = preferences.favoriteGenres[index % preferences.favoriteGenres.length];
        // Prefer the chosen genre over a potentially conflicting default genre.
        return [
          genre,
          genre ? criteria.descriptors.slice(0, 2).join(" ") : base,
          criteria.vocals === "prefer_instrumental" && genre ? "instrumental" : "",
          language,
        ]
          .filter(Boolean)
          .join(" ");
      });
      try {
        const timeout = AbortSignal.timeout(8000);
        const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
        const batches = await Promise.all(
          queries.map(async (query) => {
            const url = new URL("https://itunes.apple.com/search");
            url.search = new URLSearchParams({
              term: query,
              media: "music",
              entity: "musicTrack",
              limit: "12",
              explicit: preferences.allowExplicit ? "Yes" : "No",
              country: "US",
            }).toString();
            const response = await fetcher(url, {
              signal: requestSignal,
              redirect: "error",
              cache: "no-store",
            });
            if (!response.ok) throw new MusicProviderError();
            const payload = z
              .object({ results: z.array(z.unknown()).max(200) })
              .parse(await response.json());
            return { query, results: payload.results };
          })
        );
        const seen = new Set<number>();
        const tracks = batches.flatMap(({ query, results }) =>
          results.flatMap((value) => {
            const parsed = trackSchema.safeParse(value);
            if (!parsed.success || seen.has(parsed.data.trackId)) return [];
            const track = parsed.data;
            const genres = catalogGenres(track.primaryGenreName);
            if (
              !preferences.allowExplicit &&
              !["cleaned", "notExplicit"].includes(track.trackExplicitness ?? "")
            )
              return [];
            if (
              preferences.dislikedGenres.length &&
              (!genres.length || genres.some((genre) => preferences.dislikedGenres.includes(genre)))
            )
              return [];
            seen.add(track.trackId);
            const favorite = genres.some((genre) => preferences.favoriteGenres.includes(genre));
            return [
              {
                favorite,
                id: String(track.trackId),
                title: track.trackName,
                artist: track.artistName,
                url: track.trackViewUrl,
                reason: `Found in a “${query}” search for your ${criteria.intent} intent.${favorite ? " Its catalog genre matches a favorite." : ""} Tempo, energy and language are not verified for this track.`,
              },
            ];
          })
        );
        return tracks
          .sort((a, b) => Number(b.favorite) - Number(a.favorite))
          .slice(0, 6)
          .map((track) => ({
            id: track.id,
            title: track.title,
            artist: track.artist,
            url: track.url,
            reason: track.reason,
          }));
      } catch {
        throw new MusicProviderError();
      }
    },
  };
}
