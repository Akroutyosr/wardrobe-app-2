import type { Category } from "./closet-data";

/** One confident block colour per category — the Twinish card system. */
export const categoryColor: Record<Category, string> = {
  tops: "bg-blossom",
  bottoms: "bg-sky",
  shoes: "bg-olivine",
  outerwear: "bg-fawn",
  accessories: "bg-maize",
};

/** Rotating palette used for numbered callouts and day cards. */
export const paletteCycle = [
  "bg-blossom",
  "bg-fawn",
  "bg-maize",
  "bg-sky",
  "bg-olivine",
  "bg-rose",
];

export const dayColor = (i: number) => paletteCycle[i % paletteCycle.length] as string;
