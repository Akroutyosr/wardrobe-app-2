import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Star } from "lucide-react";
import { initialWeek, type PlannerDay } from "@/lib/twinish-data";
import { useCloset, useOutfits, itemsByIds } from "@/lib/use-wardrobe";
import { logFeedback } from "@/lib/api";
import { dayColor } from "@/lib/palette";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Outfits of the Week · Threadit" },
      {
        name: "description",
        content:
          "A seven-day colour-coded grid of what you're wearing. Fill empty days from your saved looks and rate the ones you've worn.",
      },
      { property: "og:title", content: "Outfits of the Week · Threadit" },
      {
        property: "og:description",
        content: "Plan the week, rate the looks, let Threadit learn what you actually reach for.",
      },
    ],
  }),
  component: Planner,
});

function Planner() {
  const [week, setWeek] = useState<PlannerDay[]>(initialWeek);
  const [picking, setPicking] = useState<number | null>(null);
  const navigate = useNavigate();
  const { data: closet } = useCloset();
  const { data: outfits } = useOutfits();

  const fill = (dayIndex: number, outfitId: string) => {
    setWeek((w) => w.map((d, i) => (i === dayIndex ? { ...d, outfitId } : d)));
    setPicking(null);
  };

  const rate = (dayIndex: number, rating: number) => {
    const fitted = week[dayIndex];
    setWeek((w) => w.map((d, i) => (i === dayIndex ? { ...d, rating } : d)));
    if (fitted?.outfitId) {
      const outfit = outfits.find((o) => o.id === fitted.outfitId);
      if (outfit) void logFeedback(outfit.items ?? [], rating).catch(() => {});
    }
  };

  const planned = week.filter((d) => d.outfitId).length;

  return (
    <div className="animate-float-in">
      <header className="mb-5">
        <h1 className="display text-4xl">Outfits of the Week</h1>
        <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          {planned} of 7 days planned · aug 2–8
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        {week.map((d, i) => {
          const outfit = d.outfitId ? outfits.find((o) => o.id === d.outfitId) : undefined;
          const items = outfit ? itemsByIds(outfit.items, closet).slice(0, 4) : [];
          return (
            <div
              key={d.day}
              className={`rounded-3xl p-2.5 text-ink shadow-polaroid ${dayColor(i)} ${
                i === 6 ? "col-span-2" : ""
              }`}
            >
              <div className="flex items-baseline justify-between px-1 pb-2">
                <span className="text-sm font-extrabold uppercase tracking-widest">{d.day}</span>
                <span className="font-mono text-[0.65rem] font-bold opacity-70">{d.date}</span>
              </div>

              {outfit ? (
                <button
                  onClick={() =>
                    navigate({ to: "/look/$outfitId", params: { outfitId: outfit.id } })
                  }
                  className="tappable block w-full"
                >
                  <div
                    className={`grid gap-0.5 overflow-hidden rounded-2xl ${i === 6 ? "grid-cols-4" : "grid-cols-2"}`}
                  >
                    {items.map((it) => (
                      <img
                        key={it.id}
                        src={it.image}
                        alt={it.name}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 truncate text-left text-[0.78rem] font-bold">
                    {outfit.title}
                  </p>
                </button>
              ) : (
                <button
                  onClick={() => setPicking(i)}
                  aria-label={`Add an outfit for ${d.day}`}
                  className={`tappable flex w-full items-center justify-center rounded-2xl bg-card/60 text-ink/60 ${
                    i === 6 ? "h-20" : "aspect-square"
                  }`}
                >
                  <Plus size={28} strokeWidth={2.6} />
                </button>
              )}

              <div className="flex justify-center gap-0.5 pt-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => outfit && rate(i, n)}
                    disabled={!outfit}
                    aria-label={`Rate ${d.day} ${n} stars`}
                    className="disabled:opacity-30"
                  >
                    <Star
                      size={13}
                      className={d.rating && n <= d.rating ? "fill-rose text-rose" : "text-ink/30"}
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <p className="handwritten mt-4 text-center text-xl text-foreground/70">
        Stars teach Threadit what you actually reach for ⭐️
      </p>

      {picking !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-6">
          <div className="animate-print w-full max-w-[28rem] rounded-3xl bg-card p-5 shadow-lift">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="display text-2xl">Pick a saved look</h2>
              <button
                onClick={() => setPicking(null)}
                className="tappable rounded-full bg-muted px-3 py-1 text-xs font-bold"
              >
                Close
              </button>
            </div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {outfits.map((o, n) => (
                <button
                  key={o.id}
                  onClick={() => fill(picking, o.id)}
                  className={`tappable flex w-full items-center gap-3 rounded-2xl p-2 text-left text-ink ${dayColor(n)}`}
                >
                  <div className="grid w-16 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-lg">
                    {itemsByIds(o.items, closet)
                      .slice(0, 4)
                      .map((it) => (
                        <img
                          key={it.id}
                          src={it.image}
                          alt=""
                          className="aspect-square object-cover"
                        />
                      ))}
                  </div>
                  <span className="text-sm font-bold leading-tight">{o.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link to="/ideas" className="tappable rounded-3xl bg-olivine px-4 py-4 text-left text-ink">
          <span className="display block text-2xl">Find more looks</span>
          <span className="text-xs font-bold opacity-75">Swipe the idea deck</span>
        </Link>
        <Link to="/add" className="tappable rounded-3xl bg-maize px-4 py-4 text-left text-ink">
          <span className="display block text-2xl">Add an item</span>
          <span className="text-xs font-bold opacity-75">One photo, auto-tagged</span>
        </Link>
      </div>
    </div>
  );
}
