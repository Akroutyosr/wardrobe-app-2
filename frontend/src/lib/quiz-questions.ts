import { IMAGE_BASE } from "@/lib/api";
import type { ApiItem } from "@/lib/api";

/**
 * The 18-question style quiz bank (Phase B).
 *
 * 18 questions = 6 Section-1 wardrobe pairs (built live from real items) +
 * 6 Section-2 scenarios (real items filtered by occasion/formality/season) +
 * 6 Section-3 shopping-instinct questions (static).
 *
 * Every option carries the metadata the backend `/api/quiz/analyze` endpoint
 * needs (formality, pattern, color_family, axis_signals) so the final
 * personality analysis is grounded in the actual wardrobe.
 */

export type AxisSignals = {
  casual_formal: number; // -2 to +2 contribution to that axis
  minimal_maximal: number;
  timeless_trendy: number;
};

export type QuizOption = {
  id: string;
  label: string;
  image?: string; // wardrobe item image or scenario collage
  formality: number; // 1-5
  pattern: string; // from schema vocab
  color_family: string;
  axis_signals: AxisSignals;
};

export type QuizQuestion = {
  id: string;
  section: 1 | 2 | 3;
  type: "wardrobe-pair" | "scenario" | "instinct";
  prompt: string;
  options: QuizOption[];
};

// --- Section 1: wardrobe pairs ----------------------------------------------

// Pull 2 random items per question from different categories.
// Show item photo, NO labels/names -- pure visual preference.
const SECTION_1_PROMPTS = [
  "Which piece feels more like you?",
  "If you could only keep one, you'd choose...",
  "Which one would you reach for first on a Monday morning?",
  "Which piece makes you feel most confident?",
  "Which one better represents how you want to dress?",
  "Which piece would you wear to meet someone new?",
];

// --- Section 2: scenario prompts --------------------------------------------

// Hardcoded with real wardrobe items fetched at runtime.
const SECTION_2_PROMPTS: {
  prompt: string;
  occasion: string;
  min_formality?: number;
  max_formality?: number;
  season?: string;
}[] = [
  {
    prompt: "Last-minute dinner reservation tonight. You grab...",
    occasion: "dinner",
    min_formality: 3,
  },
  {
    prompt: "Weekend farmers market. You're wearing...",
    occasion: "casual",
    max_formality: 2,
  },
  {
    prompt: "Work presentation you actually care about. You choose...",
    occasion: "work",
    min_formality: 3,
  },
  {
    prompt: "First date, coffee shop. You pick...",
    occasion: "date",
    season: "fall",
  },
  {
    prompt: "Lazy Sunday, but you might run into someone you know. You wear...",
    occasion: "casual",
    max_formality: 2,
  },
  {
    prompt: "Flight day. Comfort matters, but so does looking put-together. You pack...",
    occasion: "travel",
    max_formality: 3,
  },
];

// --- Section 3: shopping instincts (static) ---------------------------------

const SECTION_3: QuizQuestion[] = [
  {
    id: "q13",
    section: 3,
    type: "instinct",
    prompt: "A gorgeous piece is 40% off but doesn't fit anything you own. You...",
    options: [
      {
        id: "a",
        label: "Buy it — I'll make it work",
        formality: 3,
        pattern: "other",
        color_family: "bold",
        axis_signals: { casual_formal: 0, minimal_maximal: 2, timeless_trendy: 1 },
      },
      {
        id: "b",
        label: "Pass — I only buy what I'll actually wear",
        formality: 3,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: 0, minimal_maximal: -2, timeless_trendy: -1 },
      },
    ],
  },
  {
    id: "q14",
    section: 3,
    type: "instinct",
    prompt: "Your wardrobe style in one sentence:",
    options: [
      {
        id: "a",
        label: "Less, but better",
        formality: 3,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: 0, minimal_maximal: -2, timeless_trendy: -1 },
      },
      {
        id: "b",
        label: "More options, more fun",
        formality: 2,
        pattern: "other",
        color_family: "varied",
        axis_signals: { casual_formal: -1, minimal_maximal: 2, timeless_trendy: 1 },
      },
      {
        id: "c",
        label: "A few great pieces that do everything",
        formality: 3,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: 0, minimal_maximal: -1, timeless_trendy: -2 },
      },
    ],
  },
  {
    id: "q15",
    section: 3,
    type: "instinct",
    prompt: "How do you feel when you get dressed in the morning?",
    options: [
      {
        id: "a",
        label: "I have a system — it takes 3 minutes",
        formality: 3,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: 0, minimal_maximal: -2, timeless_trendy: -1 },
      },
      {
        id: "b",
        label: "I love the process of putting a look together",
        formality: 3,
        pattern: "other",
        color_family: "varied",
        axis_signals: { casual_formal: 0, minimal_maximal: 1, timeless_trendy: 0 },
      },
      {
        id: "c",
        label: "Honestly, it stresses me out",
        formality: 2,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: -1, minimal_maximal: 0, timeless_trendy: 0 },
      },
    ],
  },
  {
    id: "q16",
    section: 3,
    type: "instinct",
    prompt: "A piece that costs $200 but you'll wear it 100 times vs. $30 you'll wear 5 times:",
    options: [
      {
        id: "a",
        label: "$200 — cost per wear is what matters",
        formality: 4,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: 1, minimal_maximal: -1, timeless_trendy: -2 },
      },
      {
        id: "b",
        label: "$30 — I like variety and newness",
        formality: 2,
        pattern: "other",
        color_family: "varied",
        axis_signals: { casual_formal: -1, minimal_maximal: 2, timeless_trendy: 2 },
      },
    ],
  },
  {
    id: "q17",
    section: 3,
    type: "instinct",
    prompt: "Your shopping trigger is usually:",
    options: [
      {
        id: "a",
        label: "I identified a specific gap in my wardrobe",
        formality: 3,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: 0, minimal_maximal: -2, timeless_trendy: -1 },
      },
      {
        id: "b",
        label: "I saw something and fell in love with it",
        formality: 3,
        pattern: "other",
        color_family: "bold",
        axis_signals: { casual_formal: 0, minimal_maximal: 1, timeless_trendy: 1 },
      },
      {
        id: "c",
        label: "Season change or a new occasion coming up",
        formality: 3,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: 0, minimal_maximal: 0, timeless_trendy: -1 },
      },
    ],
  },
  {
    id: "q18",
    section: 3,
    type: "instinct",
    prompt: "How would your friends describe your style?",
    options: [
      {
        id: "a",
        label: "Always put-together, never tries too hard",
        formality: 3,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: 0, minimal_maximal: -1, timeless_trendy: -2 },
      },
      {
        id: "b",
        label: "Bold, unexpected, memorable",
        formality: 3,
        pattern: "other",
        color_family: "bold",
        axis_signals: { casual_formal: 0, minimal_maximal: 2, timeless_trendy: 2 },
      },
      {
        id: "c",
        label: "Cozy and approachable",
        formality: 1,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: -2, minimal_maximal: -1, timeless_trendy: -1 },
      },
      {
        id: "d",
        label: "Elegant and a bit serious",
        formality: 5,
        pattern: "solid",
        color_family: "neutral",
        axis_signals: { casual_formal: 2, minimal_maximal: -1, timeless_trendy: -2 },
      },
    ],
  },
];

// --- Deriving per-option metadata from real items ---------------------------

/** The item fields the dynamic sections need. `ApiItem` satisfies this. */
export type QuizItemSource = Pick<
  ApiItem,
  "id" | "image" | "category" | "primary_color" | "pattern" | "formality" | "seasons"
>;

const NEUTRAL_COLORS = new Set([
  "neutral",
  "white",
  "black",
  "cream",
  "gray",
  "grey",
  "beige",
  "brown",
  "tan",
  "navy",
]);

function clampSignal(v: number): number {
  return Math.max(-2, Math.min(2, v));
}

/** Derive -2..+2 axis contributions from an item's tagging metadata. */
function deriveAxisSignals(formality: number, pattern: string, colorFamily: string): AxisSignals {
  const casual_formal = clampSignal(formality - 3); // 1→-2 … 5→+2
  let minimal = 0;
  let trendy = 0;
  switch (pattern) {
    case "solid":
      minimal -= 1;
      trendy -= 1;
      break;
    case "striped":
    case "checked":
    case "floral":
      minimal += 1;
      trendy += 1;
      break;
    case "graphic":
      minimal += 2;
      trendy += 2;
      break;
    default:
      minimal += 1;
      break;
  }
  const family = colorFamily.toLowerCase();
  if (NEUTRAL_COLORS.has(family)) {
    minimal -= 1;
    trendy -= 1;
  } else if (family === "bold" || family === "varied") {
    minimal += 1;
    trendy += 1;
  }
  return {
    casual_formal,
    minimal_maximal: clampSignal(minimal),
    timeless_trendy: clampSignal(trendy),
  };
}

function colorFamilyFor(item: QuizItemSource): string {
  return item.primary_color?.trim() || "neutral";
}

function toOption(item: QuizItemSource, id: string): QuizOption {
  const pattern = item.pattern?.trim() || "other";
  const color_family = colorFamilyFor(item);
  return {
    id,
    label: item.id,
    image: IMAGE_BASE(item.image),
    formality: item.formality,
    pattern,
    color_family,
    axis_signals: deriveAxisSignals(item.formality, pattern, color_family),
  };
}

// --- Sampling helpers --------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j]!;
    a[j] = tmp!;
  }
  return a;
}

/** Pick 2 items from different categories when possible (falls back to any 2). */
function pickPair(candidates: QuizItemSource[]): QuizItemSource[] {
  const pool = shuffle(candidates.filter((i) => i.image));
  if (pool.length === 0) return [];
  if (pool.length === 1) return [pool[0]!];
  const first = pool[0]!;
  const other = pool.slice(1).find((i) => i.category !== first.category);
  return other ? [first, other] : [first, pool[1]!];
}

// --- Deck builders -----------------------------------------------------------

function buildSection1(items: QuizItemSource[]): QuizQuestion[] {
  const withImage = items.filter((i) => i.image);
  return SECTION_1_PROMPTS.map((prompt, idx) => {
    const [a, b] = pickPair(withImage);
    const options = [a, b]
      .filter(Boolean)
      .map((it, i) => toOption(it!, `q${idx + 1}-${i === 0 ? "a" : "b"}`));
    return {
      id: `q${idx + 1}`,
      section: 1 as const,
      type: "wardrobe-pair" as const,
      prompt,
      options,
    };
  });
}

function matchesScenario(item: QuizItemSource, f: (typeof SECTION_2_PROMPTS)[number]): boolean {
  if (f.min_formality && item.formality < f.min_formality) return false;
  if (f.max_formality && item.formality > f.max_formality) return false;
  if (f.season && !item.seasons.includes(f.season)) return false;
  return true;
}

function buildSection2(items: QuizItemSource[]): QuizQuestion[] {
  return SECTION_2_PROMPTS.map((scenario, idx) => {
    const matching = items.filter((i) => i.image && matchesScenario(i, scenario));
    const candidates = matching.length >= 2 ? matching : items.filter((i) => i.image);
    const [a, b] = pickPair(candidates);
    const options = [a, b]
      .filter(Boolean)
      .map((it, i) => toOption(it!, `q${idx + 7}-${i === 0 ? "a" : "b"}`));
    return {
      id: `q${idx + 7}`,
      section: 2 as const,
      type: "scenario" as const,
      prompt: scenario.prompt,
      options,
    };
  });
}

/** The full 18-question deck. Sections 1 & 2 are rebuilt from the live closet on each call. */
export function buildQuizQuestions(items: QuizItemSource[]): QuizQuestion[] {
  return [...buildSection1(items), ...buildSection2(items), ...SECTION_3];
}

/** All static prompts/options (sections 1 & 2 arrive via `buildQuizQuestions`). */
export const STATIC_QUESTIONS = SECTION_3;
