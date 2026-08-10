import { outfits, type Outfit } from "./closet-data";

export type Weather = {
  temp: number;
  condition: string;
  emoji: string;
  high: number;
  low: number;
  hours: { label: string; temp: number; emoji: string }[];
};

export const todayWeather: Weather = {
  temp: 17,
  condition: "Clear, light breeze",
  emoji: "☀️",
  high: 19,
  low: 11,
  hours: [
    { label: "NOW", temp: 17, emoji: "☀️" },
    { label: "11AM", temp: 18, emoji: "☀️" },
    { label: "1PM", temp: 19, emoji: "🌤️" },
    { label: "3PM", temp: 18, emoji: "🌤️" },
    { label: "5PM", temp: 15, emoji: "🌥️" },
  ],
};

/** Extra scrapbook detail layered on top of the base outfit data. */
export type OutfitExtra = {
  time: string;
  handNote: string;
  /** % coordinates for the numbered callout badges on the binder page */
  spots: { top: number; left: number }[];
};

export const outfitExtras: Record<string, OutfitExtra> = {
  o1: {
    time: "8:15 AM",
    handNote:
      "Soft on top, sturdy on the bottom — the boots keep the knit from reading as pyjamas.",
    spots: [
      { top: 14, left: 22 },
      { top: 30, left: 72 },
      { top: 66, left: 30 },
      { top: 78, left: 68 },
    ],
  },
  o2: {
    time: "9:40 AM",
    handNote: "Stripes + denim never argue. The tiny bag stops it feeling like an errand.",
    spots: [
      { top: 16, left: 68 },
      { top: 34, left: 26 },
      { top: 62, left: 72 },
      { top: 80, left: 34 },
    ],
  },
  o3: {
    time: "10:00 AM",
    handNote: "Lavender does the charm, the pleats do the swish. Sneakers keep it un-serious.",
    spots: [
      { top: 12, left: 30 },
      { top: 36, left: 70 },
      { top: 60, left: 24 },
      { top: 80, left: 64 },
    ],
  },
  o4: {
    time: "6:30 PM",
    handNote: "One loud piece, everything else whispering. That's the whole trick.",
    spots: [
      { top: 15, left: 26 },
      { top: 34, left: 70 },
      { top: 64, left: 32 },
      { top: 79, left: 70 },
    ],
  },
  o5: {
    time: "7:50 AM",
    handNote: "Camel over cream, warm on warm. Wrap the coat, don't button it.",
    spots: [
      { top: 13, left: 68 },
      { top: 32, left: 28 },
      { top: 63, left: 70 },
      { top: 82, left: 30 },
    ],
  },
  o6: {
    time: "11:20 AM",
    handNote: "Three textures stacked: ribbed, cotton, pleat. Effort level: zero.",
    spots: [
      { top: 16, left: 24 },
      { top: 33, left: 68 },
      { top: 62, left: 26 },
      { top: 80, left: 66 },
    ],
  },
};

export const extraFor = (id: string): OutfitExtra =>
  outfitExtras[id] ?? {
    time: "9:00 AM",
    handNote: "A quiet, easy one — nothing here is trying too hard.",
    spots: [
      { top: 15, left: 25 },
      { top: 35, left: 70 },
      { top: 65, left: 28 },
      { top: 80, left: 66 },
    ],
  };

export const outfitById = (id: string): Outfit | undefined => outfits.find((o) => o.id === id);

/** Fabric / construction notes shown as arrow callouts on the item detail page. */
export const itemNotes: Record<string, string[]> = {
  sweater: [
    "Chunky brioche rib — holds shape after washing",
    "Dropped shoulder = comfy layering room",
  ],
  jeans: ["Rigid 100% cotton, softens with wear", "High rise sits right at the waist"],
  sneakers: ["Smooth leather, wipes clean in seconds", "Rubber cup sole, still zero creasing"],
  trench: ["Brushed wool blend, wraps with a belt", "Deep patch pockets, no gaping"],
  dress: ["Bias-cut midi — swings when you walk", "Ties at the back for a custom fit"],
  tee: ["Yarn-dyed stripes, no fading", "Slightly boxy, tucks flat"],
  bag: ["Vegetable-tanned tan leather", "Adjustable strap, crossbody or shoulder"],
  boots: ["Elastic gusset, pull-on in one go", "Stacked heel, quietly adds height"],
  skirt: ["Knife pleats, pressed to stay sharp", "Elastic back panel — secretly comfy"],
  blazer: ["Slouchy shoulder, no padding", "Half-lined, wearable in spring"],
  necklace: ["Gold-fill, doesn't turn your skin", "Lobster clasp, layers with anything"],
  cardigan: ["Butter-soft cotton knit", "Shell buttons, worth the upgrade"],
};

/** Weekly planner mock data (Sun → Sat). */
export type PlannerDay = {
  day: string;
  date: number;
  outfitId: string | null;
  rating: number | null;
};

export const initialWeek: PlannerDay[] = [
  { day: "Sun", date: 2, outfitId: "o4", rating: 5 },
  { day: "Mon", date: 3, outfitId: "o1", rating: 4 },
  { day: "Tue", date: 4, outfitId: "o5", rating: 3 },
  { day: "Wed", date: 5, outfitId: "o2", rating: null },
  { day: "Thu", date: 6, outfitId: null, rating: null },
  { day: "Fri", date: 7, outfitId: "o3", rating: null },
  { day: "Sat", date: 8, outfitId: null, rating: null },
];

/** Style quiz: this-or-that pairs built from closet photos.
 * Each side carries controlled style metadata (schema.py's Pattern set and
 * formality 1-5) that is posted to /api/quiz/preference when chosen. */
export type QuizSide = {
  itemId: string;
  label: string;
  trait: string;
  formality: number;
  pattern: string;
  colorFamily: string;
};

export type QuizPair = {
  id: string;
  prompt: string;
  left: QuizSide;
  right: QuizSide;
};

export const quizPairs: QuizPair[] = [
  {
    id: "q1",
    prompt: "Saturday morning, you reach for…",
    left: {
      itemId: "sweater",
      label: "Big cosy knit",
      trait: "soft",
      formality: 1,
      pattern: "solid",
      colorFamily: "cream",
    },
    right: {
      itemId: "blazer",
      label: "Slouchy blazer",
      trait: "sharp",
      formality: 3,
      pattern: "solid",
      colorFamily: "black",
    },
  },
  {
    id: "q2",
    prompt: "Your shoe of choice today",
    left: {
      itemId: "sneakers",
      label: "Crisp sneakers",
      trait: "easy",
      formality: 1,
      pattern: "solid",
      colorFamily: "white",
    },
    right: {
      itemId: "boots",
      label: "Chelsea boots",
      trait: "sharp",
      formality: 3,
      pattern: "solid",
      colorFamily: "black",
    },
  },
  {
    id: "q3",
    prompt: "Colour mood",
    left: {
      itemId: "dress",
      label: "Loud coral",
      trait: "bold",
      formality: 2,
      pattern: "solid",
      colorFamily: "coral",
    },
    right: {
      itemId: "cardigan",
      label: "Quiet butter",
      trait: "soft",
      formality: 1,
      pattern: "solid",
      colorFamily: "butter",
    },
  },
  {
    id: "q4",
    prompt: "Bottom half",
    left: {
      itemId: "jeans",
      label: "Mom jeans",
      trait: "easy",
      formality: 1,
      pattern: "solid",
      colorFamily: "denim",
    },
    right: {
      itemId: "skirt",
      label: "Pleated skirt",
      trait: "bold",
      formality: 2,
      pattern: "checked",
      colorFamily: "navy",
    },
  },
  {
    id: "q5",
    prompt: "Finishing touch",
    left: {
      itemId: "necklace",
      label: "Gold chain",
      trait: "sharp",
      formality: 3,
      pattern: "other",
      colorFamily: "gold",
    },
    right: {
      itemId: "bag",
      label: "Little crossbody",
      trait: "easy",
      formality: 2,
      pattern: "solid",
      colorFamily: "brown",
    },
  },
  {
    id: "q6",
    prompt: "Cold morning plan",
    left: {
      itemId: "trench",
      label: "Wrap coat",
      trait: "sharp",
      formality: 4,
      pattern: "solid",
      colorFamily: "camel",
    },
    right: {
      itemId: "sweater",
      label: "Double knit",
      trait: "soft",
      formality: 1,
      pattern: "striped",
      colorFamily: "charcoal",
    },
  },
  {
    id: "q7",
    prompt: "Everyday hero",
    left: {
      itemId: "tee",
      label: "Striped tee",
      trait: "easy",
      formality: 1,
      pattern: "striped",
      colorFamily: "navy",
    },
    right: {
      itemId: "dress",
      label: "Midi dress",
      trait: "bold",
      formality: 3,
      pattern: "floral",
      colorFamily: "coral",
    },
  },
];

export type StyleIdentity = { name: string; tagline: string; blurb: string; emoji: string };

export const identities: Record<string, StyleIdentity> = {
  soft: {
    name: "The Soft Landing",
    emoji: "🧸",
    tagline: "Comfort first, always cute about it",
    blurb:
      "You dress like a good hug. Knits, warm neutrals and things that move with you — and you'd rather be the calmest person in the room than the loudest.",
  },
  sharp: {
    name: "The Clean Edit",
    emoji: "✂️",
    tagline: "One sharp piece does all the talking",
    blurb:
      "You like a shape with an opinion. A structured shoulder, a good boot, gold that catches the light — nothing fussy, everything intentional.",
  },
  bold: {
    name: "The Main Character",
    emoji: "🌟",
    tagline: "Colour is your love language",
    blurb:
      "You never met a coral you didn't like. You build outfits around one loud, joyful piece and let everything else stay quiet and supportive.",
  },
  easy: {
    name: "The Effortless Regular",
    emoji: "🥐",
    tagline: "Same six pieces, endlessly remixed",
    blurb:
      "You've cracked the code: a great tee, jeans that fit, shoes you can walk miles in. It looks easy because you made it easy.",
  },
};
