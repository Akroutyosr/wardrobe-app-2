import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, startOfWeek } from "date-fns";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { useCloset, useDailyDeck, itemsByIds } from "@/lib/use-wardrobe";
import { IMAGE_BASE, fetchPlannerWeek, rateOutfit, setPlannerDay } from "@/lib/api";
import { dayColor } from "@/lib/palette";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Outfits of the Week · Twinish" },
      {
        name: "description",
        content:
          "A seven-day colour-coded grid of what you're wearing. Fill empty days from your saved looks and rate the ones you've worn.",
      },
      { property: "og:title", content: "Outfits of the Week · Twinish" },
      {
        property: "og:description",
        content: "Plan the week, rate the looks, let Twinish learn what you actually reach for.",
      },
    ],
  }),
  component: Planner,
});

type PlannedItem = { id: string; name: string; image: string; category: string };

type PlannerDay = {
  iso: string;
  label: string;
  dateLabel: string;
};

function weekDays() {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return {
      iso: format(d, "yyyy-MM-dd"),
      label: format(d, "EEE"),
      dateLabel: format(d, "d MMM"),
    };
  });
}

function Planner() {
  const days = useMemo<PlannerDay[]>(weekDays, []);
  const { data: closet } = useCloset();
  const { data: outfits } = useDailyDeck(); // today's deck, for the "+" picker
  const [picking, setPicking] = useState<number | null>(null);
  const [local, setLocal] = useState<Record<string, { outfitId?: string; rating?: number }>>({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: week, isLoading: weekLoading } = useQuery({
    queryKey: ["planner/week", days[0]!.iso, days[6]!.iso],
    queryFn: () => fetchPlannerWeek(days[0]!.iso, days[6]!.iso),
    staleTime: 30 * 1000,
  });
  const weekRows = week?.outfits;
  const savedPlans = week?.plans ?? {};

  const planMutation = useMutation({
    mutationFn: ({ day, outfitId }: { day: string; outfitId: string }) =>
      setPlannerDay(day, outfitId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner/week"] }),
    onError: () => toast.error("Couldn't save that plan — try again"),
  });

  const rowsByDate = useMemo(() => new Map((weekRows ?? []).map((o) => [o.date, o])), [weekRows]);

  const planFor = (
    day: PlannerDay,
  ): { id: string; title: string; items: PlannedItem[]; rating: number } | null => {
    const localPick = local[day.iso];
    const row = rowsByDate.get(day.iso);
    // A fresh local pick wins until the server confirms it (invalidation).
    const id = localPick?.outfitId ?? savedPlans[day.iso] ?? row?.id ?? null;
    if (!id) return null;

    if (row && row.id === id) {
      return {
        id: row.id,
        title: row.title,
        rating: localPick?.rating ?? row.rating ?? 0,
        items: row.items.map((it) => ({
          id: it.id,
          name: it.name,
          image: IMAGE_BASE(it.image),
          category: it.category,
        })),
      };
    }

    const deckOutfit = outfits?.find((o) => o.id === id);
    if (!deckOutfit) {
      // Planned on another day/session — the look page resolves it by id.
      return { id, title: "Planned look", items: [], rating: localPick?.rating ?? 0 };
    }
    return {
      id: deckOutfit.id,
      title: deckOutfit.title,
      rating: localPick?.rating ?? 0,
      items: itemsByIds(deckOutfit.items, closet).map((it) => ({
        id: it.id,
        name: it.name,
        image: it.image,
        category: it.category,
      })),
    };
  };

  const fill = (dayIndex: number, outfitId: string) => {
    const day = days[dayIndex]!.iso;
    setLocal((p) => ({ ...p, [day]: { outfitId } }));
    setPicking(null);
    planMutation.mutate({ day, outfitId });
  };

  const rate = (dayIndex: number, rating: number) => {
    const day = days[dayIndex]!; // dayIndex always < 7 here
    const row = rowsByDate.get(day.iso);
    const id = local[day.iso]?.outfitId ?? row?.id;
    if (!id) return;
    setLocal((p) => ({ ...p, [day.iso]: { ...p[day.iso], rating } }));
    void rateOutfit(id, rating).catch(() => toast.error("Couldn't save that rating — try again"));
  };

  const planned = days.filter((d) => planFor(d) !== null).length;

  return (
    <div className="animate-float-in">
      <header className="mb-5">
        <h1 className="display text-4xl">Outfits of the Week</h1>
        <p
          suppressHydrationWarning
          className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-muted-foreground"
        >
          {planned} of 7 days planned · {days[0]!.dateLabel}–{days[6]!.dateLabel}
          {weekRows === undefined && weekLoading ? " · loading…" : ""}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-7">
        {days.map((day, i) => {
          const plan = planFor(day);
          return (
            <div
              key={day.iso}
              className={`rounded-3xl p-2.5 text-ink shadow-polaroid ${dayColor(i)} ${
                i === 6 ? "col-span-2 md:col-span-1" : ""
              } ${"md:h-48 md:flex md:flex-col"}`}
            >
              <div className="flex items-baseline justify-between px-1 pb-2">
                <span
                  suppressHydrationWarning
                  className="text-sm font-extrabold uppercase tracking-widest"
                >
                  {day.label}
                </span>
                <span
                  suppressHydrationWarning
                  className="font-mono text-[0.65rem] font-bold opacity-70"
                >
                  {day.dateLabel}
                </span>
              </div>

              {plan ? (
                <button
                  onClick={() => navigate({ to: "/look/$outfitId", params: { outfitId: plan.id } })}
                  className="tappable block w-full"
                >
                  <div
                    className={`grid gap-0.5 overflow-hidden rounded-2xl ${i === 6 ? "grid-cols-4 md:grid-cols-2" : "grid-cols-2"}`}
                  >
                    {plan.items.slice(0, 4).map((it) => (
                      <img
                        key={it.id}
                        src={it.image}
                        alt={it.name}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 truncate text-left text-[0.78rem] font-bold">{plan.title}</p>
                </button>
              ) : (
                <button
                  onClick={() => setPicking(i)}
                  aria-label={`Add an outfit for ${day.label}`}
                  className={`tappable flex w-full items-center justify-center rounded-2xl bg-card/60 text-ink/60 ${
                    i === 6 ? "h-20" : "aspect-square md:aspect-auto md:flex-1"
                  }`}
                >
                  <Plus size={28} strokeWidth={2.6} />
                </button>
              )}

              <div className="flex justify-center gap-1 pt-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => plan && rate(i, n)}
                    disabled={!plan}
                    aria-label={`Rate ${day.label} ${n} stars`}
                    className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30"
                  >
                    <Star
                      size={17}
                      className={plan && n <= plan.rating ? "fill-rose text-rose" : "text-ink/30"}
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <p className="handwritten mt-4 text-center text-xl text-foreground/70">
        Stars teach Twinish what you actually reach for ⭐️
      </p>

      {picking !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-6">
          <div className="animate-print w-full max-w-[28rem] rounded-3xl bg-card p-5 shadow-lift">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="display text-2xl">Pick one of today's looks</h2>
              <button
                onClick={() => setPicking(null)}
                className="tappable rounded-full bg-muted px-3 py-1 text-xs font-bold"
              >
                Close
              </button>
            </div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {(outfits ?? []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {outfits === undefined
                    ? "Today's looks are still being styled…"
                    : "No looks yet — generate one on the home screen first."}
                </p>
              )}
              {(outfits ?? []).map((o, n) => (
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
