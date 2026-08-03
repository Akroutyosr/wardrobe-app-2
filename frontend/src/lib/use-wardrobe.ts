import { useQuery } from "@tanstack/react-query";
import type { ClosetItem, Outfit } from "./closet-data";
import { closet, colors as fallbackColors, outfits as mockOutfits } from "./closet-data";
import { fetchColors, fetchItem, fetchItems, fetchOutfit, generateOutfits } from "./api";

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

export function useItem(id: string) {
  return useQuery({
    queryKey: ["item", id],
    queryFn: () => (id ? fetchItem(id) : Promise.resolve(undefined)),
    initialData: closet.find((i) => i.id === id),
    gcTime: 5 * 60 * 1000,
  });
}

export function useOutfits(ctx?: {
  occasion?: string;
  season?: string;
  anchor_item_id?: string;
  notes?: string;
}): { data: Outfit[]; isFetching: boolean; refetch: () => void } {
  const query = useQuery({
    queryKey: [
      "outfits",
      ctx?.occasion ?? "",
      ctx?.season ?? "",
      ctx?.anchor_item_id ?? "",
      ctx?.notes ?? "",
    ],
    queryFn: () => generateOutfits(ctx),
    initialData: mockOutfits,
    staleTime: 10 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
  return {
    data: query.data as Outfit[],
    isFetching: query.isFetching,
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
  });
}

/** Distinct colors for the closet filter chips, seeded from the mock list. */
export function useColors() {
  return useQuery({
    queryKey: ["colors"],
    queryFn: () => fetchColors(),
    initialData: fallbackColors,
    staleTime: 10 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function itemsByIds(ids: string[], items: ClosetItem[]): ClosetItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter((i): i is ClosetItem => Boolean(i));
}
