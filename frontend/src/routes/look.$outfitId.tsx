import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Heart, Star } from "lucide-react";
import { toast } from "sonner";
import { useCloset, useOutfit, itemsByIds } from "@/lib/use-wardrobe";
import { rateOutfit, saveOutfit, unsaveOutfit } from "@/lib/api";
import { Callout, WashiTape, ArrowNote } from "@/components/scrapbook";
import { StitchFrame } from "@/components/stitch-frame";

export const Route = createFileRoute("/look/$outfitId")({
  head: () => ({
    meta: [
      { title: "The Look · Twinish" },
      {
        name: "description",
        content:
          "A scrapbook binder page for one outfit: numbered callouts on every piece, the styling note in handwriting, and a star rating.",
      },
      { property: "og:title", content: "The Look · Twinish" },
      { property: "og:description", content: "One outfit, annotated like a diary page." },
    ],
  }),
  loader: ({ params }) => ({ outfitId: params.outfitId }),
  component: LookPage,
});

function LookPage() {
  const { outfitId } = Route.useLoaderData();
  const queryClient = useQueryClient();
  const { data: closet } = useCloset();
  const { data: fetched, isFetching } = useOutfit(outfitId);
  const outfit = fetched;
  const items = itemsByIds(outfit?.items ?? [], closet);
  const [active, setActive] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [noted, setNoted] = useState(false);
  const [saved, setSaved] = useState(Boolean(outfit?.saved));

  const rate = (n: number) => {
    setRating(n);
    setNoted(true);
    if (outfit)
      void rateOutfit(outfit.id, n).catch(() =>
        toast.error("Couldn't save that rating — try again"),
      );
  };

  const toggleSave = async () => {
    if (!outfit) return;
    const next = !saved;
    setSaved(next); // optimistic
    try {
      if (next) await saveOutfit(outfit.id);
      else await unsaveOutfit(outfit.id);
    } catch (e) {
      console.error("save toggle failed:", e);
      toast.error("Couldn't update your saved looks");
      setSaved((s) => !s); // roll back on failure
      return;
    }
    // The saved-lists (Ideas tab, fitting room) share this query cache — refresh
    // them so a save here shows up immediately instead of serving stale data.
    await queryClient.invalidateQueries({ queryKey: ["outfits", "saved"] });
  };

  const activeItem = items[active] ?? items[0];

  if (!outfit && isFetching) {
    return (
      <div className="animate-float-in">
        <Link
          to="/planner"
          className="tappable mb-4 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-polaroid"
        >
          <ArrowLeft size={15} /> Week
        </Link>
        <section className="paper rounded-3xl p-8 text-center">
          <p className="display text-2xl">Fetching that look…</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pulling it from your wardrobe — one moment.
          </p>
        </section>
      </div>
    );
  }

  if (!outfit) {
    return (
      <div className="animate-float-in">
        <Link
          to="/planner"
          className="tappable mb-4 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-polaroid"
        >
          <ArrowLeft size={15} /> Week
        </Link>
        <section className="paper rounded-3xl p-8 text-center">
          <p className="display text-2xl">That look isn’t here anymore</p>
          <p className="mt-2 text-sm text-muted-foreground">
            It may not be saved on this device — head to the week to pick a fresh one.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="animate-float-in">
      <Link
        to="/planner"
        className="tappable mb-4 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-polaroid"
      >
        <ArrowLeft size={15} /> Week
      </Link>

      {outfit && (
        <button
          onClick={toggleSave}
          aria-label={saved ? "Remove from saved looks" : "Save this look"}
          className={`tappable mb-4 ml-2 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-polaroid ${
            saved ? "bg-rose text-primary-foreground" : "bg-card"
          }`}
        >
          <Heart size={15} fill={saved ? "currentColor" : "none"} />
          {saved ? "Saved" : "Save look"}
        </button>
      )}

      {/* binder page + right-hand panel */}
      <div className="md:flex md:flex-row md:items-start md:gap-10">
        <section className="kraft animate-print relative overflow-hidden rounded-3xl p-4 pt-8 md:min-w-0 md:flex-1">
          <WashiTape className="-left-6 top-4 w-36 -rotate-[18deg]" />
          <p className="handwritten absolute left-8 top-2 z-30 text-4xl text-foreground">Look</p>

          <div className="relative mt-6 grid grid-cols-2 gap-3">
            {items.map((item, i) => (
              <div key={item.id} className="relative">
                <button
                  onClick={() => setActive(i)}
                  className={`polaroid tappable block w-full p-1.5 ${
                    active === i ? "ring-2 ring-primary" : ""
                  }`}
                  style={{ transform: `rotate(${i % 2 ? 2 : -2}deg)` }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="aspect-square w-full rounded-[0.8rem] object-cover"
                  />
                </button>
                <Callout
                  n={i + 1}
                  active={active === i}
                  onClick={() => setActive(i)}
                  className="absolute -left-2 -top-2"
                />
              </div>
            ))}
            <span className="pointer-events-none absolute -bottom-2 right-1 text-2xl">⭐️</span>
          </div>

          <p className="handwritten mt-5 text-2xl leading-snug">{outfit?.title ?? ""}</p>
          {outfit.caption ? <ArrowNote className="mt-2">{outfit.caption}</ArrowNote> : null}
          <StitchFrame delay={200} />
        </section>

        {/* the tapped callout's detail card + rating */}
        <div className="mt-5 space-y-4 md:mt-0 md:w-[22rem] md:min-w-0 lg:w-1/3">
          <section className="paper rounded-3xl p-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
              callout {active + 1} of {items.length}
            </p>
            {activeItem ? (
              <div className="mt-2 flex gap-3">
                <img
                  src={activeItem.image}
                  alt={activeItem.name}
                  className="h-24 w-24 shrink-0 rounded-2xl object-cover shadow-polaroid"
                />
                <div>
                  <h2 className="text-base font-bold">{activeItem.name}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{activeItem.note}</p>
                  <Link
                    to="/closet/$itemId"
                    params={{ itemId: activeItem.id }}
                    className="tappable mt-2 inline-block rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    Open item card
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No items in this look yet.</p>
            )}
          </section>

          <section className="rounded-3xl bg-secondary px-5 py-4 text-center">
            <p className="handwritten text-2xl text-secondary-foreground">How did this one feel?</p>
            <div className="mt-2 flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => rate(n)}
                  aria-label={`${n} stars`}
                  className="tappable flex h-11 w-11 items-center justify-center"
                >
                  <Star
                    size={26}
                    className={
                      rating && n <= rating ? "fill-primary text-primary" : "text-foreground/25"
                    }
                  />
                </button>
              ))}
              {(noted || rating) && (
                <p className="animate-pop mt-2 font-mono text-[0.68rem] uppercase tracking-widest text-primary">
                  noted — future picks just got smarter
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
