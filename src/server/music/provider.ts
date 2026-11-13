import "server-only";
import type { MusicCriteria } from "../../features/music/schemas";
import type { MusicTrack } from "../../features/music/api-types";

export interface MusicProvider {
  recommend(criteria: MusicCriteria, signal?: AbortSignal): Promise<MusicTrack[]>;
}
export class MusicProviderError extends Error {
  constructor() {
    super("The music provider is unavailable. Please try again.");
  }
}
