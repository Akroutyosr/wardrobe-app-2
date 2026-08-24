import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shuffle, ArrowRight, Flame, Trophy, Loader2 } from "lucide-react";
import { extraFor } from "@/lib/twinish-data";
import { useCloset, useOutfits, useStats, useWeather, itemsByIds } from "@/lib/use-wardrobe";
import type { WardrobeStats } from "@/lib/api";
import { weatherEmoji } from "@/lib/weather";
import type { WeatherNow } from "@/lib/weather";
import { Confetti } from "@/components/Confetti";
import { PlateCard } from "@/components/plate";
import { QuickLog } from "@/components/QuickLog";
import { ChallengeCard } from "@/components/ChallengeCard";
import { dismissNudgeToday, markLoggedToday, shouldShowNudge } from "@/lib/habit-nudge";
import { currencySymbol, fetchSuggestedOutfit } from "@/lib/api";
import { useChallenges } from "@/lib/use-wardrobe";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today's forecast & fit · Twinish" },
      {
        name: "description",
        content:
          "17° and clear — here's today's outfit, popped fresh out of your own closet. Weather card, outfit picks, streak and versatility score in one place.",
      },
      { property: "og:title", content: "Today's forecast & fit · Twinish" },
      {
        property: "og:description",
        content: "A weather card that hands you an outfit from clothes you already own.",
      },
    ],
  }),
  component: Today,
});

function DeckLoading() {
  const steps = [
    "Reading your closet…",
    "Checking today's weather…",
    "Consulting the AI stylist…",
    "Polishing the final look…",
  ];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % steps.length), 3000);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose/10">
          <Loader2 className="animate-spin text-rose" size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-foreground">Picking today&apos;s look…</p>
          <p className="truncate text-xs font-semibold text-muted-foreground">{steps[step]}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-square animate-pulse rounded-3xl bg-muted" />
        ))}
      </div>
      <p className="pt-4 text-center text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        AI styling takes a minute — hang tight
      </p>
    </div>
  );
}

function currentSeason(d: Date = new Date()): string {
  const month = d.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

/**
 * Coarse weather descriptor for the LLM context. Bucketing (instead of the raw
 * degree number) keeps the backend deck-cache key stable through the day, so
 * refresh/re-visit reuses the persisted deck instead of re-running Gemini every
 * time the thermometer ticks over. Condition changes still bust the cache.
 */
function weatherBucket(tempC: number): string {
  if (tempC <= 5) return "cold";
  if (tempC <= 12) return "cool";
  if (tempC <= 20) return "mild";
  if (tempC <= 26) return "warm";
  return "hot";
}

function weatherNotes(w: WeatherNow): string {
  return `${weatherBucket(w.temperature)} and ${w.condition.toLowerCase()}`;
}

function Today() {
  const [index, setIndex] = useState(0);
  const [fire] = useState(0);
  // Daily habit nudge: server truth (already logged today?) wins over the
  // local flag, so a log made on another device also silences this.
  const [showNudge, setShowNudge] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [suggestedItems, setSuggestedItems] = useState<string[]>([]);
  useEffect(() => {
    setShowNudge(shouldShowNudge());
    fetchSuggestedOutfit().then((data) => {
      if (!data) return;
      if (data.already_logged) {
        markLoggedToday();
        setShowNudge(false);
      } else if (data.items?.length > 0) {
        setSuggestedItems(data.items.map((i) => i.id));
      }
    });
  }, []);
  const { data: closet } = useCloset();
  const { data: weather } = useWeather();
  const STATS_DEFAULT: WardrobeStats = {
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
  };
  const { data: stats = STATS_DEFAULT } = useStats();
  const { data: challenges = [] } = useChallenges();
  // Pass the live weather into the LLM deck so the generated outfits and their
  // reasoning actually reflect today's real conditions. Generation waits for
  // the weather fetch so we never fire a wasteful empty-context deck first.
  const {
    data: outfits,
    isFetching,
    error,
    refetch,
  } = useOutfits(
    weather
      ? {
          occasion: "casual",
          season: currentSeason(),
          notes: weatherNotes(weather),
        }
      : undefined,
    Boolean(weather),
  );

  const deck = outfits ?? [];
  const outfit = deck.length > 0 ? deck[index % deck.length] : null;
  const loadingDeck = !outfit && (isFetching || !weather);

  const items = outfit ? itemsByIds(outfit.items, closet) : [];
  const extra = outfit ? extraFor(outfit.id) : null;
  const temp = weather?.temperature;
  const condition = weather ? weather.condition : "Checking the sky…";
  const emoji = weather ? weatherEmoji(weather.weatherCode) : "🔮";
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const shuffle = () => setIndex((i) => i + 1);

  return (
    <div className="animate-float-in lg:mx-auto lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-8">
      <header className="mb-4 flex items-center justify-between lg:col-span-2">
        <div>
          <p className="display text-3xl">Twinish</p>
          <p
            suppressHydrationWarning
            className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {today}
          </p>
        </div>
        {stats.streak > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose px-3.5 py-2 text-sm font-extrabold text-primary-foreground shadow-lift">
            <Flame size={16} strokeWidth={2.6} /> {stats.streak}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground shadow-polaroid">
            Log an outfit to start your streak ✨
          </span>
        )}
      </header>

      {showNudge && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-4xl border border-rose/40 bg-blush px-4 py-3.5 lg:col-span-2">
          <div>
            <p className="text-sm font-extrabold text-foreground">
              {suggestedItems.length > 0
                ? "Looks like a typical day for you — log your outfit?"
                : "What did you wear today?"}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
              Takes 10 seconds. Helps Twinish learn your style.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => {
                dismissNudgeToday();
                setShowNudge(false);
              }}
              className="tappable py-1 text-xs font-bold text-muted-foreground"
            >
              Later
            </button>
            <button
              onClick={() => setQuickLogOpen(true)}
              className="tappable rounded-full bg-rose px-3 py-1.5 text-xs font-extrabold text-primary-foreground"
            >
              Log it →
            </button>
          </div>
        </div>
      )}

      {/* Challenges sit ABOVE the outfit deck so they're instantly reachable —
          even while a fresh deck is still generating below. */}
      {challenges.length > 0 && (
        <section className="mb-4 lg:col-span-2">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="display text-xl">Your challenges</h2>
            <span className="font-mono text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
              {challenges.length} active
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {challenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        </section>
      )}

      {/* Weather card with the outfit popping in below it */}
      <section className="relative overflow-hidden rounded-4xl bg-card shadow-lift lg:sticky lg:top-8">
        <Confetti fire={fire} />

        <div className="bg-gradient-to-b from-sky to-sky/70 px-5 pb-6 pt-7 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-6xl font-extrabold leading-none">{temp ?? "…"}°</p>
              <p className="mt-1.5 text-sm font-semibold opacity-95">
                {emoji} {condition}
              </p>
            </div>
            <p className="pt-2 text-xs font-semibold opacity-90">
              H:{weather?.high ?? "–"}° L:{weather?.low ?? "–"}°
            </p>
          </div>

          <div className="mt-5 flex justify-between rounded-2xl bg-white/25 px-3 py-3 backdrop-blur">
            {(weather?.hours ?? []).map((h) => (
              <div key={h.label} className="flex flex-col items-center gap-1">
                <span className="text-[0.6rem] font-bold tracking-wider">{h.label}</span>
                <span className="text-base">{h.emoji}</span>
                <span className="text-sm font-bold">{h.temp}°</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5 pt-5">
          {loadingDeck ? (
            <DeckLoading />
          ) : outfit ? (
            <>
              <PlateCard
                key={outfit.id}
                label={weather ? `${today} · ${weather.condition.toLowerCase()}` : today}
                items={items}
              />

              <p className="handwritten mt-4 text-[1.25rem] leading-snug text-foreground/75">
                “{extra?.handNote}”
              </p>

              <div className="mt-4 flex gap-2">
                <Link
                  to="/look/$outfitId"
                  params={{ outfitId: outfit.id }}
                  className="tappable flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose py-3.5 text-sm font-extrabold text-primary-foreground"
                >
                  See the look <ArrowRight size={17} />
                </Link>
                <button
                  onClick={shuffle}
                  aria-label="Shuffle for another fit"
                  className="tappable flex items-center justify-center gap-1.5 rounded-2xl bg-maize px-4 text-sm font-extrabold text-ink"
                >
                  <Shuffle size={17} />
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-3xl bg-muted px-5 py-6 text-center">
              <p className="text-sm font-semibold text-muted-foreground">
                {error
                  ? "Couldn't build a look right now."
                  : "No look available yet — add clothes in the Closet first."}
              </p>
              {error ? (
                <button
                  onClick={() => refetch()}
                  className="tappable mt-3 rounded-full bg-rose px-4 py-2 text-xs font-extrabold text-primary-foreground"
                >
                  Try again
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {/* second column on lg: stats, score, quick links */}
      <div className="lg:min-w-0">
        {/* colour-blocked stat pills */}
        <div className="mt-4 grid grid-cols-3 gap-2 lg:mt-0">
          <div className="rounded-2xl bg-blossom px-3 py-3 text-ink">
            <p className="text-xl font-extrabold leading-none">{stats.total_items}</p>
            <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide">items</p>
          </div>
          <div className="rounded-2xl bg-olivine px-3 py-3 text-ink">
            <p className="text-xl font-extrabold leading-none">{stats.worn_this_month}</p>
            <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide">worn / mo</p>
          </div>
          <div className="rounded-2xl bg-rose px-3 py-3 text-primary-foreground">
            <p className="text-xl font-extrabold leading-none">{stats.streak}🔥</p>
            <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide">day streak</p>
          </div>
        </div>

        {/* game-stat score: avg cost-per-wear once prices exist, versatility before that */}
        <section className="mt-4 overflow-hidden rounded-4xl bg-ink text-background shadow-lift">
          <div className="flex items-center justify-between px-5 py-5">
            <div>
              {stats.avg_cost_per_wear != null ? (
                <>
                  <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.25em] opacity-70">
                    Avg cost per wear
                  </p>
                  <p className="mt-1 text-6xl font-extrabold leading-none text-maize">
                    {currencySymbol(stats.currency)}
                    {stats.avg_cost_per_wear}
                  </p>
                  <p className="mt-1 text-xs font-semibold opacity-75">
                    across {stats.items_with_price} priced{" "}
                    {stats.items_with_price === 1 ? "piece" : "pieces"} — real wears, not guesses
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.25em] opacity-70">
                    Versatility score
                  </p>
                  <p className="mt-1 text-6xl font-extrabold leading-none text-maize">
                    {stats.versatility_score}
                  </p>
                  <p className="mt-1 text-xs font-semibold opacity-75">
                    {stats.versatility_score > 0
                      ? `possible outfit combinations from your ${stats.total_items} items`
                      : "Add items to your closet to unlock this"}
                  </p>
                </>
              )}
            </div>
            <Trophy size={54} className="text-maize" strokeWidth={1.6} />
          </div>
          <div className="space-y-1.5 bg-card px-4 pb-4 pt-3 text-foreground">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
              Leaderboard · most worn
            </p>
            {stats.most_worn.length > 0 ? (
              stats.most_worn.map((item, i) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-ink ${
                    ["bg-olivine", "bg-maize", "bg-sky", "bg-blossom", "bg-fawn"][i] ??
                    "bg-secondary"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-card text-xs font-extrabold">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-bold capitalize">
                    {item.subcategory}
                    <span className="ml-1 text-xs opacity-60">{item.primary_color}</span>
                  </span>
                  <span className="font-mono text-[0.7rem] font-bold">{item.wear_count}×</span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Start logging outfits to see your most-worn pieces
              </p>
            )}
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            to="/should-i-buy"
            className="tappable rounded-3xl bg-fawn px-4 py-5 text-left text-ink"
          >
            <span className="display block text-2xl">Should I buy this?</span>
            <span className="mt-1 block text-xs font-bold opacity-75">Receipt-style verdict</span>
          </Link>
          <Link
            to="/planner"
            className="tappable rounded-3xl bg-blossom px-4 py-5 text-left text-ink"
          >
            <span className="display block text-2xl">Week ahead</span>
            <span className="mt-1 block text-xs font-bold opacity-75">
              Plan and rate your looks
            </span>
          </Link>
        </div>
      </div>

      {/* QuickLog sheet, pre-populated with auto-suggested items */}
      <QuickLog
        isOpen={quickLogOpen}
        onClose={() => {
          setQuickLogOpen(false);
          setShowNudge(false);
        }}
        preselectedItemIds={suggestedItems}
      />
    </div>
  );
}
