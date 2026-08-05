import type { ClosetItem, Outfit } from "./closet-data";

/**
 * Phase 6: thin REST client for the FastAPI backend.
 *
 * Set VITE_API_URL in frontend/.env to point at the backend (defaults to a
 * local uvicorn on :8000). Every read here resolves through a shared cache,
 * and every flow degrades to the local mock data in closet-data.ts if the
 * backend isn't reachable, so the UI never looks broken during development.
 */

/**
 * Resolve the backend base URL. In production builds (Cloudflare Workers) the
 * deployed backend is the default; local `npm run dev` keeps localhost:8000.
 * VITE_API_URL (frontend/.env or CI env) still overrides both.
 */
const DEFAULT_API_BASE = import.meta.env.DEV ? "http://localhost:8000" : "https://wardrobe-app-2.onrender.com";
export const API_BASE = import.meta.env["VITE_API_URL"] ?? DEFAULT_API_BASE;

export const IMAGE_BASE = (url: string) => (url.startsWith("http") ? url : `${API_BASE}${url}`);

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`[api] ${res.status} on ${path}`);
    return (await res.json()) as T;
  } catch (err) {
    throw new Error(`[api] request failed: ${path} — ${String(err)}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

// --- Backend DTO shape (mirrors app/api.py item_to_dto) ---
export type ApiItem = {
  id: string;
  name: string;
  image: string;
  category: string;
  color: string;
  primary_color: string;
  subcategory: string;
  pattern: string;
  formality: number;
  formality_label: string;
  seasons: string[];
  fabric_guess: string;
  notes: string;
  worn: number;
  distance?: number;
};

export type ApiOutfit = {
  id: string;
  title: string;
  caption: string;
  item_ids: string[];
  items: ApiItem[];
};

/** Structured tags produced by the tagging pipeline (ClothingItem schema). */
export type Tags = {
  category: string;
  subcategory: string;
  primary_color: string;
  secondary_color?: string | null;
  pattern: string;
  formality: number;
  seasons: string[];
  fabric_guess: string;
  notes: string;
};

export type VersatilityCall = {
  versatility_score?: number;
  pairs_with?: { id: string; category: string; subcategory: string }[];
  total_wardrobe_size?: number;
};

export type ToolResult = VersatilityCall & {
  has_likely_duplicates?: boolean;
  duplicates?: unknown[];
  error?: string;
  [key: string]: unknown;
};

export type VerdictResult = {
  verdict: string;
  tool_log: {
    name: string;
    args: Record<string, unknown>;
    result: ToolResult;
  }[];
  new_item: Tags;
};

// --- Adapters to the frontend's existing shapes -----------------------------

export function toClosetItem(a: ApiItem): ClosetItem {
  return {
    id: a.id,
    name: a.name,
    image: IMAGE_BASE(a.image),
    category: a.category as ClosetItem["category"],
    color: a.color,
    season: a.seasons as ClosetItem["season"],
    formality: a.formality_label ?? String(a.formality),
    worn: a.worn,
    note: a.notes,
  };
}

export function toOutfit(o: ApiOutfit, known: ClosetItem[]): Outfit {
  const knownById = new Map(known.map((i) => [i.id, i]));
  const items = o.item_ids.filter((id) => knownById.has(id));
  return {
    id: o.id,
    title: o.title,
    caption: o.caption,
    items,
  };
}

// --- Wardrobe ---------------------------------------------------------------

export async function fetchItems(params?: {
  category?: string;
  season?: string;
}): Promise<ClosetItem[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.season) q.set("season", params.season);
  const data = await fetchJson<ApiItem[]>(`/api/items${q.size ? `?${q}` : ""}`);
  return data.map(toClosetItem);
}

export async function fetchItem(id: string): Promise<ClosetItem | undefined> {
  const data = await fetchJson<ApiItem>(`/api/items/${encodeURIComponent(id)}`);
  return toClosetItem(data);
}

export async function fetchSimilar(id: string, k = 5): Promise<ClosetItem[]> {
  const data = await fetchJson<ApiItem[]>(`/api/items/${encodeURIComponent(id)}/similar?k=${k}`);
  return data
    .filter((i) => i.id !== id) // the query item always matches itself
    .map(toClosetItem);
}

// --- Outfits -----------------------------------------------------------------

export async function generateOutfits(
  ctx: {
    occasion?: string;
    season?: string;
    anchor_item_id?: string;
    notes?: string;
  } = {},
): Promise<Outfit[]> {
  const known = await fetchItems();
  const data = await fetchJson<{ outfits: ApiOutfit[] }>("/api/outfits/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...ctx, notes: ctx.notes ?? "" }),
  });
  return data.outfits.map((o) => toOutfit(o, known));
}

// --- Feedback ---------------------------------------------------------------

/**
 * Rate an outfit that was persisted at generation time. Reuses the outfit's
 * stable id so the rated/worn state shares one identity with the deep-linked
 * view, instead of minting a throwaway id on first rating.
 */
export async function rateOutfit(outfitId: string, rating: number, wornOn?: string): Promise<void> {
  await fetchJson(`/api/outfits/${encodeURIComponent(outfitId)}/rate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rating, worn_on: wornOn }),
  });
}

// --- Deep-link / outfit resolution ------------------------------------------

type RawOutfit = { id: string; item_ids: string[]; reasoning?: string };

/**
 * Load one persisted outfit by its stable id — the real deep-link fix for
 * /look/<id>. Resolves item ids against the (cached) closet to build the
 * same display shape generateOutfits produces. Returns undefined if the
 * id isn't found or the backend is unreachable.
 */
export async function fetchOutfit(id: string): Promise<Outfit | null> {
  try {
    const known = await fetchItems();
    const raw = await fetchJson<RawOutfit>(`/api/outfits/${encodeURIComponent(id)}`);
    const byId = new Map(known.map((i) => [i.id, i]));
    const items = raw.item_ids.filter((iid) => byId.has(iid));
    const title =
      items
        .slice(0, 3)
        .map((iid) => byId.get(iid)!.name)
        .join(" · ") || `Look ${raw.id}`;
    return { id: raw.id, title, caption: raw.reasoning ?? "", items };
  } catch {
    // Not found or unreachable backend — null (not undefined, which React
    // Query v5 rejects) so the caller can fall back to the deck / not-found.
    return null;
  }
}

// --- Colors ----------------------------------------------------------------

/** Distinct base colors actually present in the wardrobe, for the filter chips. */
export async function fetchColors(): Promise<string[]> {
  return fetchJson<string[]>("/api/colors");
}

// --- Add item ----------------------------------------------------------------

export async function uploadPhoto(file: File): Promise<{ image_path: string; tags: Tags }> {
  const body = new FormData();
  body.append("upload", file);
  return fetchJson<{ image_path: string; tags: Tags }>("/api/items/upload", {
    method: "POST",
    body,
  });
}

export async function addItem(imagePath: string, tags: Tags): Promise<ClosetItem> {
  const data = await fetchJson<ApiItem>("/api/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_path: imagePath, tags }),
  });
  return toClosetItem(data);
}

// --- Shopping assistant ------------------------------------------------------

export async function shouldIBuy(file: File): Promise<VerdictResult> {
  const body = new FormData();
  body.append("upload", file);
  return fetchJson<VerdictResult>("/api/should-i-buy", {
    method: "POST",
    body,
  });
}
