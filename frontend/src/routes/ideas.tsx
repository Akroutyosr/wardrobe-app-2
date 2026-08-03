import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, X, RotateCcw } from "lucide-react";
import { useCloset, useOutfits, itemsByIds } from "@/lib/use-wardrobe";
import { ItemThumb } from "@/components/ui-bits";
import { Confetti } from "@/components/Confetti";

export const Route = createFileRoute("/ideas")({
  head: () => ({
    meta: [
      { title: "Outfit Ideas · Threadit" },
      {
        name: "description",
        content: "Swipe through outfit ideas built from your own wardrobe. Keep the ones you love.",
      },
      { property: "og:title", content: "Outfit Ideas · Threadit" },
      { property: "og:description", content: "Swipe right on outfits made from clothes you own." },
    ],
  }),
  component: Ideas,
});

function Ideas() {
  const [tab, setTab] = useState<"deck" | "saved">("deck");
  const [index, setIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [fire, setFire] = useState(0);
  const { data: closet } = useCloset();
  const { data: outfits } = useOutfits({ notes: "inspire me" });

  const current = outfits[index];
  const saved = outfits.filter((o) => savedIds.includes(o.id));
  const resolve = (ids: string[]) => itemsByIds(ids, closet);

  const decide = (dir: "left" | "right") => {
    if (!current || leaving) return;
    setLeaving(dir);
    if (dir === "right") {
      setSavedIds((s) => [...s, current.id]);
      setFire((f) => f + 1);
    }
    setTimeout(() => {
      setIndex((i) => i + 1);
      setLeaving(null);
    }, 300);
  };

  return (
    <div className="animate-float-in">
      <header className="mb-4">
        <h1 className="text-3xl font-bold">Outfit ideas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All made from things you already own. Keep what sparks something.
        </p>
      </header>

      <div className="mb-5 flex gap-2 rounded-full bg-secondary p-1">
        {(["deck", "saved"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm font-bold capitalize transition-colors ${
              tab === t ? "bg-card text-primary shadow-polaroid" : "text-muted-foreground"
            }`}
          >
            {t === "deck" ? "Discover" : `Saved (${saved.length})`}
          </button>
        ))}
      </div>

      {tab === "deck" ? (
        <div className="relative min-h-[30rem]">
          <Confetti fire={fire} />
          {current ? (
            <>
              <div
                className={`rounded-3xl bg-card p-5 shadow-lift transition-all duration-300 ${
                  leaving === "right"
                    ? "translate-x-40 rotate-12 opacity-0"
                    : leaving === "left"
                      ? "-translate-x-40 -rotate-12 opacity-0"
                      : "translate-x-0 rotate-0 opacity-100"
                }`}
              >
                <div className="grid grid-cols-2 gap-3">
                  {resolve(current.items).map((it, i) => (
                    <ItemThumb
                      key={it.id}
                      item={it}
                      rotate={i % 2 === 0 ? -2 : 2}
                      className="aspect-square"
                    />
                  ))}
                </div>
                <h2 className="mt-5 text-xl font-bold">{current.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {current.caption}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-center gap-6">
                <button
                  onClick={() => decide("left")}
                  aria-label="Skip this outfit"
                  className="tappable flex h-16 w-16 items-center justify-center rounded-full bg-card text-muted-foreground shadow-lift"
                >
                  <X size={28} strokeWidth={2.6} />
                </button>
                <button
                  onClick={() => decide("right")}
                  aria-label="Save this outfit"
                  className="tappable flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift"
                >
                  <Heart size={34} fill="currentColor" />
                </button>
              </div>
              <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">
                {outfits.length - index} ideas left today
              </p>
            </>
          ) : (
            <div className="rounded-3xl bg-card p-10 text-center shadow-lift">
              <p className="text-5xl">🌷</p>
              <h2 className="mt-4 text-xl font-bold">That's every idea for today!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You saved {saved.length}. Fresh combos land again tomorrow morning.
              </p>
              <button
                onClick={() => setIndex(0)}
                className="tappable mt-5 inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground"
              >
                <RotateCcw size={16} /> Go through them again
              </button>
            </div>
          )}
        </div>
      ) : saved.length === 0 ? (
        <div className="rounded-3xl bg-card p-10 text-center shadow-polaroid">
          <p className="text-4xl">💌</p>
          <h2 className="mt-3 text-lg font-bold">No saves yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Swipe through Discover and keep the ones that feel like you.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {saved.map((o) => (
            <div key={o.id} className="rounded-3xl bg-card p-3 shadow-polaroid">
              <div className="grid grid-cols-2 gap-1.5">
                {resolve(o.items)
                  .slice(0, 4)
                  .map((it) => (
                    <ItemThumb key={it.id} item={it} className="aspect-square" />
                  ))}
              </div>
              <p className="mt-2 text-sm font-bold leading-snug">{o.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
