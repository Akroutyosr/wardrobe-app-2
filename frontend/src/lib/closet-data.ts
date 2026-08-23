import sweater from "@/assets/item-sweater.jpg";
import jeans from "@/assets/item-jeans.jpg";
import sneakers from "@/assets/item-sneakers.jpg";
import trench from "@/assets/item-trench.jpg";
import dress from "@/assets/item-dress.jpg";
import tee from "@/assets/item-tee.jpg";
import bag from "@/assets/item-bag.jpg";
import boots from "@/assets/item-boots.jpg";
import skirt from "@/assets/item-skirt.jpg";
import blazer from "@/assets/item-blazer.jpg";
import necklace from "@/assets/item-necklace.jpg";
import cardigan from "@/assets/item-cardigan.jpg";

export type Category = "tops" | "bottoms" | "shoes" | "outerwear" | "accessories";
export type Season = "spring" | "summer" | "fall" | "winter";

export type ClosetItem = {
  id: string;
  name: string;
  image: string;
  cutout?: string;
  category: Category;
  color: string;
  season: Season[];
  formality: string;
  worn: number;
  note: string;
  /** Real cost-per-wear from the backend (price / wear count); absent when unpriced. */
  cpw?: number | null;
};

export const closet: ClosetItem[] = [
  {
    id: "sweater",
    name: "Cloud Knit Sweater",
    image: sweater,
    category: "tops",
    color: "cream",
    season: ["fall", "winter"],
    formality: "cozy casual",
    worn: 14,
    note: "Your most-reached-for hug in sweater form.",
  },
  {
    id: "jeans",
    name: "Sunday Mom Jeans",
    image: jeans,
    category: "bottoms",
    color: "blue",
    season: ["spring", "fall", "winter"],
    formality: "casual",
    worn: 22,
    note: "The reliable one. Goes with basically everything.",
  },
  {
    id: "sneakers",
    name: "Fresh White Sneakers",
    image: sneakers,
    category: "shoes",
    color: "white",
    season: ["spring", "summer", "fall"],
    formality: "casual",
    worn: 31,
    note: "Still crisp! Nice work.",
  },
  {
    id: "trench",
    name: "Camel Wrap Coat",
    image: trench,
    category: "outerwear",
    color: "camel",
    season: ["fall", "winter"],
    formality: "smart",
    worn: 7,
    note: "Instant put-together energy over anything.",
  },
  {
    id: "dress",
    name: "Poppy Field Midi",
    image: dress,
    category: "tops",
    color: "coral",
    season: ["spring", "summer"],
    formality: "dressy",
    worn: 5,
    note: "Made for patio brunches and long golden evenings.",
  },
  {
    id: "tee",
    name: "Striped Everyday Tee",
    image: tee,
    category: "tops",
    color: "navy",
    season: ["spring", "summer"],
    formality: "casual",
    worn: 18,
    note: "A tiny bit French, always easy.",
  },
  {
    id: "bag",
    name: "Little Tan Crossbody",
    image: bag,
    category: "accessories",
    color: "tan",
    season: ["spring", "summer", "fall"],
    formality: "casual",
    worn: 26,
    note: "Holds exactly what you need, nothing you don't.",
  },
  {
    id: "boots",
    name: "Black Chelsea Boots",
    image: boots,
    category: "shoes",
    color: "black",
    season: ["fall", "winter"],
    formality: "smart",
    worn: 12,
    note: "Sharpen up any soft outfit in one step.",
  },
  {
    id: "skirt",
    name: "Olive Pleated Skirt",
    image: skirt,
    category: "bottoms",
    color: "green",
    season: ["spring", "fall"],
    formality: "dressy",
    worn: 6,
    note: "Swishes when you walk. That's the whole review.",
  },
  {
    id: "blazer",
    name: "Lavender Slouch Blazer",
    image: blazer,
    category: "outerwear",
    color: "lavender",
    season: ["spring", "fall"],
    formality: "smart",
    worn: 9,
    note: "Your secret weapon for 'is this a meeting or a date?'",
  },
  {
    id: "necklace",
    name: "Gold Chain Necklace",
    image: necklace,
    category: "accessories",
    color: "gold",
    season: ["spring", "summer", "fall", "winter"],
    formality: "any",
    worn: 20,
    note: "Two seconds of effort, ten times the polish.",
  },
  {
    id: "cardigan",
    name: "Butter Button Cardigan",
    image: cardigan,
    category: "tops",
    color: "cream",
    season: ["spring", "fall"],
    formality: "cozy casual",
    worn: 11,
    note: "The 'just in case it gets chilly' hero.",
  },
];

export const byId = (id: string) => closet.find((i) => i.id === id);

export const itemsFor = (ids: string[]) => ids.map(byId).filter((i): i is ClosetItem => Boolean(i));

export type Outfit = {
  id: string;
  title: string;
  caption: string;
  items: string[];
  saved?: boolean;
};

export const outfits: Outfit[] = [
  {
    id: "o1",
    title: "Rainy Tuesday Softness",
    caption: "Cozy but put-together — the knit does the comfort, the boots do the grown-up part.",
    items: ["sweater", "jeans", "boots", "necklace"],
  },
  {
    id: "o2",
    title: "Coffee Run, But Make It Cute",
    caption: "Stripes plus denim never argues with anything. The little bag keeps it light.",
    items: ["tee", "jeans", "sneakers", "bag"],
  },
  {
    id: "o3",
    title: "Lavender Meeting Energy",
    caption: "Soft colour, sharp shape. The blazer says capable, the sneakers say still fun.",
    items: ["blazer", "tee", "skirt", "sneakers"],
  },
  {
    id: "o4",
    title: "Golden Hour Plans",
    caption: "The midi carries the whole look, so everything else just needs to stay quiet.",
    items: ["dress", "sneakers", "necklace", "bag"],
  },
  {
    id: "o5",
    title: "Crisp Autumn Walk",
    caption: "Camel over cream is a classic for a reason — warm on warm, always flattering.",
    items: ["trench", "sweater", "jeans", "boots"],
  },
  {
    id: "o6",
    title: "Weekend Layer Cake",
    caption: "Cardigan over stripes with the olive skirt: three textures, zero effort.",
    items: ["cardigan", "tee", "skirt", "boots"],
  },
];

export const categories: Category[] = ["tops", "bottoms", "shoes", "outerwear", "accessories"];
export const colors = [
  "cream",
  "blue",
  "white",
  "camel",
  "coral",
  "navy",
  "tan",
  "black",
  "green",
  "lavender",
  "gold",
];
export const seasons: Season[] = ["spring", "summer", "fall", "winter"];
