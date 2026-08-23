import { useQuery } from "@tanstack/react-query";
import type { ClosetItem, Outfit } from "./closet-data";
import { closet, colors as fallbackColors } from "./closet-data";
import {
  fetchColors,
  fetchItem,
  fetchItems,
  fetchOutfit,
  fetchSavedOutfits,
  fetchStats,
  generateOutfits,
  type WardrobeStats,
} from "./api";
import { fetchWeather, getLocation } from "./weather";

/**
 * Shared wardrobe state for the Phase 6 wiring.
 *
 * These hooks seed from the local mock data so pages render instantly and still
 * look fine offline, then swap in real backend data the moment the API responds.
 */
export function useCloset() {
  return useQuery({
    queryKey: ["closet"],
    queryFn: () => fetchItems(),
    initialData: closet,
    gcTime: 5 * 60 * 1000,
  });
}

export function useItem(id: string): { data: ClosetItem | undefined; isFetching: boolean } {
  const query = useQuery({
    queryKey: ["item", id],
    queryFn: () => (id ? fetchItem(id) : Promise.resolve(undefined)),
    initialData: closet.find((i) => i.id === id),
    gcTime: 5 * 60 * 1000,
  });
  return { data: query.data, isFetching: query.isFetching };
}

export function useOutfits(
  ctx?: {
    occasion?: string;
    season?: string;
    anchor_item_id?: string;
    notes?: string;
  },
  enabled?: boolean,
): {
  data: Outfit[];
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: [
      "outfits",
      ctx?.occasion ?? "",
      ctx?.season ?? "",
      ctx?.anchor_item_id ?? "",
      ctx?.notes ?? "",
    ],
    queryFn: () => generateOutfits(ctx),
    staleTime: 10 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: enabled ?? true,
  });
  return {
    data: (query.data ?? []) as Outfit[],
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}

/**
 * Resolve one outfit by its stable persisted id. Seeds from the current
 * generation deck when the id is already there, and falls back to
 * GET /api/outfits/{id} otherwise — the deep-link path.
 */
export function useOutfit(id: string) {
  return useQuery({
    queryKey: ["outfit", id],
    queryFn: () => fetchOutfit(id),
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    // The deep-link fetch can hit Render's cold start; retry briefly instead
    // of instantly settling to "not found".
    retry: 2,
    retryDelay: (attempt) => attempt * 1500 + 1000,
  });
}

/** Saved (favorited) outfits — the durable favorites list. */
export function useSavedOutfits() {
  return useQuery({
    queryKey: ["outfits", "saved"],
    queryFn: () => fetchSavedOutfits(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** Distinct colors for the closet filter chips, seeded from the mock list. */
export function useColors() {
  return useQuery({
    queryKey: ["colors"],
    queryFn: () => fetchColors(),
    placeholderData: fallbackColors,
    staleTime: 10 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** Aggregate wardrobe stats: total items, worn-this-month, streak, versatility. */
export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 5 * 60 * 1000,
    placeholderData: {
      total_items: 0,
      worn_this_month: 0,
      streak: 0,
      versatility_score: 0,
      weekly_change: 0,
      most_worn: [],
      avg_cost_per_wear: null,
      items_with_price: 0,
      best_value_item_id: null,
      currency: "EUR",
    } satisfies WardrobeStats,
  });
}

/**
 * Live weather for the Home screen. Runs only in the browser so the geolocation
 * prompt is actually shown to the visitor (server renders the fallback coords
 * from VITE_DEFAULT_LAT/LON instead).
 */
export function useWeather() {
  return useQuery({
    queryKey: ["weather"],
    queryFn: async () => {
      const { lat, lon } = await getLocation();
      return fetchWeather(lat, lon);
    },
    enabled: typeof window !== "undefined",
    staleTime: 15 * 60 * 1000, // weather doesn't need refetching every render
  });
}

export function itemsByIds(ids: string[], items: ClosetItem[]): ClosetItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter((i): i is ClosetItem => Boolean(i));
}
