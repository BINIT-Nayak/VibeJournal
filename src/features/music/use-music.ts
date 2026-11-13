"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMusicTimeOfDay } from "./recommendation-service";
import type { MusicIntent, MusicTimeOfDay } from "./schemas";
import type { MusicRecommendations, MusicSource } from "./api-types";

export type MusicSelection = { intent: MusicIntent; timeOfDay: MusicTimeOfDay; energy?: number };
export function useMusic(userId: string) {
  const client = useQueryClient();
  const selectionKey = ["music-selection", userId];
  const selection = useQuery<MusicSelection | null>({
    queryKey: selectionKey,
    queryFn: () => null,
    initialData: null,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  }).data;
  const source = useQuery({
    queryKey: ["music-source", userId],
    staleTime: 0,
    queryFn: async ({ signal }): Promise<MusicSource> => {
      const response = await fetch("/api/music", { signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Could not load your mood.");
      return data.source;
    },
  });
  const recommendations = useQuery({
    queryKey: ["music-recommendations", userId, selection, source.data],
    enabled:
      !!selection &&
      !!source.data &&
      (source.data.energy !== null || selection.energy !== undefined),
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<MusicRecommendations | null> => {
      const response = await fetch("/api/music", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Could not load music.");
      return data.recommendations;
    },
  });
  const select = (intent: MusicIntent, energy?: number) =>
    client.setQueryData(selectionKey, {
      intent,
      timeOfDay: getMusicTimeOfDay(new Date().getHours()),
      ...(energy === undefined ? {} : { energy }),
    });
  return {
    selection,
    select,
    clear: () => client.setQueryData(selectionKey, null),
    source,
    recommendations,
  };
}
