import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shuffle, ArrowRight, Flame, Trophy } from "lucide-react";
import { todayWeather, extraFor } from "@/lib/twinish-data";
import { useCloset, useOutfits, itemsByIds } from "@/lib/use-wardrobe";
import { Confetti } from "@/components/Confetti";
import { Callout } from "@/components/scrapbook";
import { categoryColor } from "@/lib/palette";

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

function Today() {
  const [index, setIndex] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [fire] = useState(0);
  const { data: closet } = useCloset();
  const { data: outfits, isFetching } = useOutfits();

  const deck = outfits ?? [];
  const outfit = deck.length > 0 ? deck[index % deck.length] : null;
  const items = outfit ? itemsByIds(outfit.items, closet) : [];
  const extra = outfit ? extraFor(outfit.id) : null;
  const w = todayWeather;
  const leaderboard = [...closet].sort((a, b) => b.worn - a.worn).slice(0, 3);

  const shuffle = () => {
    setPrinting(true);
    setTimeout(() => {
      setIndex((i) => i + 1);
      setPrinting(false);
    }, 220);
  };

  return (
    <div className="animate-float-in">
      {!outfit && (
        <div className="mb-4 rounded-3xl bg-muted px-5 py-6 text-center text-sm font-semibold text-muted-foreground">
          {isFetching ? "Picking today's look…" : "No look available — try the Closet."}
        </div>
      )}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="display text-3xl">Twinish</p>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Sunday 2 August
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose px-3.5 py-2 text-sm font-extrabold text-primary-foreground shadow-lift">
          <Flame size={16} strokeWidth={2.6} /> 6
        </span>
      </header>

      {/* Weather card with the outfit popping in below it */}
      <section className="relative overflow-hidden rounded-4xl bg-card shadow-lift">
        <Confetti fire={fire} />

        <div className="bg-gradient-to-b from-sky to-sky/70 px-5 pb-6 pt-7 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-6xl font-extrabold leading-none">{w.temp}°</p>
              <p className="mt-1.5 text-sm font-semibold opacity-95">
                {w.emoji} {w.condition}
              </p>
            </div>
            <p className="pt-2 text-xs font-semibold opacity-90">
              H:{w.high}° L:{w.low}°
            </p>
          </div>

          <div className="mt-5 flex justify-between rounded-2xl bg-white/25 px-3 py-3 backdrop-blur">
            {w.hours.map((h) => (
              <div key={h.label} className="flex flex-col items-center gap-1">
                <span className="text-[0.6rem] font-bold tracking-wider">{h.label}</span>
                <span className="text-base">{h.emoji}</span>
                <span className="text-sm font-bold">{h.temp}°</span>
              </div>
            ))}
          </div>
        </div>

        {outfit && (
          <div className="px-5 pb-5 pt-5">
            <h1 className="display text-3xl">{w.temp}° and clear — here's your pick</h1>

            <div
              key={outfit.id}
            className={`mt-4 grid grid-cols-2 gap-3 ${printing ? "opacity-0" : "animate-print"}`}
          >
            {items.map((item, i) => (
              <div key={item.id} className="relative">
                <div className="tappable overflow-hidden rounded-3xl bg-muted shadow-polaroid">
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-1 px-2.5 py-2">
                    <p className="truncate text-[0.72rem] font-bold leading-tight">{item.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide text-ink ${categoryColor[item.category]}`}
                    >
                      {item.category}
                    </span>
                  </div>
                </div>
                <Callout n={i + 1} className="absolute -left-2 -top-2" />
              </div>
            ))}
          </div>

          <p className="handwritten mt-4 text-[1.25rem] leading-snug text-foreground/75">
            “{extra.handNote}”
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={shuffle}
              className="tappable flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose py-3.5 text-sm font-extrabold text-primary-foreground"
            >
              <Shuffle size={17} /> Shuffle my fit
            </button>
            <Link
              to="/look/$outfitId"
              params={{ outfitId: outfit.id }}
              className="tappable flex items-center justify-center gap-1.5 rounded-2xl bg-maize px-4 text-sm font-extrabold text-ink"
            >
              See look <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        )}
      </section>

      {/* colour-blocked stat pills */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-blossom px-3 py-3 text-ink">
          <p className="text-xl font-extrabold leading-none">{closet.length}</p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide">items</p>
        </div>
        <div className="rounded-2xl bg-olivine px-3 py-3 text-ink">
          <p className="text-xl font-extrabold leading-none">
            {closet.reduce((sum, i) => sum + i.worn, 0)}
          </p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide">worn</p>
        </div>
        <div className="rounded-2xl bg-rose px-3 py-3 text-primary-foreground">
          <p className="text-xl font-extrabold leading-none">6🔥</p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide">day streak</p>
        </div>
      </div>

      {/* game-stat score */}
      <section className="mt-4 overflow-hidden rounded-4xl bg-ink text-background shadow-lift">
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.25em] opacity-70">
              Versatility score
            </p>
            <p className="mt-1 text-6xl font-extrabold leading-none text-maize">842</p>
            <p className="mt-1 text-xs font-semibold opacity-75">+38 this week · nice mixing 👏</p>
          </div>
          <Trophy size={54} className="text-maize" strokeWidth={1.6} />
        </div>
        <div className="space-y-1.5 bg-card px-4 pb-4 pt-3 text-foreground">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
            Leaderboard · most worn
          </p>
          {[
            {
              n: 1,
              name: leaderboard[0]?.name ?? "Fresh White Sneakers",
              v: `${leaderboard[0]?.worn ?? 31} wears`,
              c: "bg-olivine",
            },
            {
              n: 2,
              name: leaderboard[1]?.name ?? "Little Tan Crossbody",
              v: `${leaderboard[1]?.worn ?? 26} wears`,
              c: "bg-maize",
            },
            {
              n: 3,
              name: leaderboard[2]?.name ?? "Sunday Mom Jeans",
              v: `${leaderboard[2]?.worn ?? 22} wears`,
              c: "bg-sky",
            },
          ].map((r) => (
            <div
              key={r.n}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-ink ${r.c}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-card text-xs font-extrabold">
                {r.n}
              </span>
              <span className="flex-1 truncate text-sm font-bold">{r.name}</span>
              <span className="font-mono text-[0.7rem] font-bold">{r.v}</span>
            </div>
          ))}
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
          <span className="mt-1 block text-xs font-bold opacity-75">Plan and rate your looks</span>
        </Link>
      </div>
    </div>
  );
}
