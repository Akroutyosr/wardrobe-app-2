import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { itemNotes } from "@/lib/twinish-data";
import { useCloset, useItem, useOutfits, useSavedOutfits, itemsByIds } from "@/lib/use-wardrobe";
import { deleteItem } from "@/lib/api";
import { Badge } from "@/components/ui-bits";
import { Callout, ArrowNote, WashiTape } from "@/components/scrapbook";

export const Route = createFileRoute("/closet/$itemId")({
  head: () => ({
    meta: [
      { title: "Item card · Twinish" },
      {
        name: "description",
        content:
          "A polaroid item card: main photo, detail shots, arrow callouts on the fabric and construction, plus every outfit it appears in.",
      },
      { property: "og:title", content: "Item card · Twinish" },
      {
        property: "og:description",
        content: "Fabric notes, wear count and outfit ideas for one piece.",
      },
    ],
  }),
  loader: ({ params }) => ({ itemId: params.itemId }),
  component: ItemDetail,
});

function ItemDetail() {
  const { itemId } = Route.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: item, isFetching: itemLoading } = useItem(itemId);
  const { data: closet } = useCloset();
  // Companion items come from the durable saved looks (instantly cached by the
  // Ideas tab) instead of auto-triggering a new deck generation just to render
  // the "Outfits with this" strip on every item page visit.
  const { data: savedLooks } = useSavedOutfits();
  // On-demand generation anchored on THIS item — the deck only shares the page
  // if the user asks ("build looks around this"), so it never re-runs Gemini
  // uninvited, and it works for items that were never in a daily deck.
  const [building, setBuilding] = useState(false);
  const { data: anchorOutfits, isFetching: anchorsLoading } = useOutfits(
    { anchor_item_id: item?.id ?? "" },
    building && Boolean(item),
  );
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const removeItem = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await deleteItem(item.id);
      // The item may have been the anchor of cached outfit decks too — drop
      // the closet (and outfits) so nothing stale lingers after navigating back.
      await queryClient.invalidateQueries({ queryKey: ["closet"] });
      await queryClient.invalidateQueries({ queryKey: ["outfits"] });
      navigate({ to: "/closet" });
    } catch (err) {
      console.error("delete failed:", err);
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (!item && itemLoading) {
    return (
      <div className="animate-float-in">
        <Link
          to="/closet"
          className="tappable mb-4 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-polaroid"
        >
          <ArrowLeft size={15} /> Closet
        </Link>
        <section className="paper rounded-3xl p-8 text-center">
          <p className="display text-2xl">Fetching that piece…</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pulling it from your wardrobe — one moment.
          </p>
        </section>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="animate-float-in rounded-3xl bg-card p-8 text-center shadow-polaroid">
        <p className="text-lg font-bold">Nothing hanging with that id.</p>
        <p className="mt-1 text-sm text-muted-foreground">It might not be in your closet yet.</p>
        <Link
          to="/closet"
          className="tappable mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
        >
          Back to my closet
        </Link>
      </div>
    );
  }

  const notes = itemNotes[item.id] ?? [
    item.note ?? "A quiet workhorse — nothing flashy, always useful.",
  ];
  const related = itemsByIds(
    (savedLooks ?? [])
      .filter((o) => o.items.includes(item.id))
      .flatMap((o) => o.items),
    closet,
  ).slice(0, 3);
  const itemSummary = item.name;

  return (
    <div className="animate-float-in">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          to="/closet"
          className="tappable inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-polaroid"
        >
          <ArrowLeft size={15} /> Closet
        </Link>

        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="tappable rounded-full bg-card px-4 py-2 text-xs font-bold text-muted-foreground shadow-polaroid"
            >
              Keep it
            </button>
            <button
              onClick={removeItem}
              disabled={deleting}
              className="tappable inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-xs font-bold text-primary-foreground shadow-lift"
            >
              {deleting ? "Removing…" : "Delete forever"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="tappable inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground shadow-polaroid"
          >
            <Trash2 size={15} /> Delete
          </button>
        )}
      </div>

      <div className="md:flex md:flex-row md:items-start md:gap-10">
      <section className="kraft relative overflow-hidden rounded-3xl p-4 pt-7 md:min-w-0 md:flex-1">
        <WashiTape className="-right-7 top-4 w-32 rotate-[20deg]" />
        <p className="handwritten absolute left-6 top-1 text-3xl">no. {item.id}</p>

        <div className="relative">
          <div className="polaroid animate-print p-2.5">
            <img
              src={item.image}
              alt={item.name}
              className="w-full rounded-2xl object-cover md:w-1/2 md:max-w-sm"
            />
            <p className="handwritten px-1 pt-2 text-2xl leading-none">{item.name}</p>
          </div>
          <Callout n={1} className="absolute -left-2 -top-2" />
        </div>

        {/* detail-shot insets */}
        <div className="mt-4 flex gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="relative w-1/2">
              <div className="polaroid p-1.5" style={{ transform: `rotate(${i ? 2.5 : -2.5}deg)` }}>
                <img
                  src={item.image}
                  alt={`${item.name} detail shot ${i + 1}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover"
                  style={{ objectPosition: i ? "80% 20%" : "20% 80%" }}
                />
              </div>
              <Callout n={i + 2} className="absolute -left-2 -top-2" />
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {notes.map((n, i) => (
            <ArrowNote key={n} flip={i % 2 === 1}>
              {n}
            </ArrowNote>
          ))}
        </div>
      </section>

      <div className="mt-4 md:mt-0 md:min-w-0 md:flex-1">
        <p className="handwritten text-2xl leading-snug text-foreground/80">{item.note}</p>

        <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="primary">{item.color}</Badge>
        <Badge tone="lilac">{item.formality}</Badge>
        {item.season.map((s) => (
          <Badge key={s} tone="mint">
            {s}
          </Badge>
        ))}
        <Badge tone="butter">{item.category}</Badge>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary px-5 py-4 font-mono text-[0.7rem] font-bold uppercase tracking-widest text-secondary-foreground">
        <span>worn {item.worn}×</span>
        <span>in {related.length} looks</span>
        <span>great value / wear</span>
      </div>
      </div>
      </div>

      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="display mb-2 text-2xl">Outfits with this</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
            {related.slice(0, 4).map((it) => (
              <div key={it.id} className="tappable paper w-28 shrink-0 rounded-2xl p-2.5">
                <img
                  src={it.image}
                  alt={it.name}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <p className="truncate pt-1.5 text-xs font-bold">{it.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="display mb-2 text-2xl">Build looks around this</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {building
            ? "Styling a fresh set with this piece at the center…"
            : "Want full outfits built around this item, not just today's deck?"}
        </p>

        {building && anchorsLoading && (
          <div className="animate-pulse rounded-3xl bg-card p-6">
            <p className="text-sm font-semibold text-muted-foreground">
              Asking the stylist… takes a moment
            </p>
          </div>
        )}

        {building && !anchorsLoading && anchorOutfits.length > 0 && (
          <div className="space-y-3">
            {anchorOutfits.slice(0, 4).map((o) => (
              <Link
                key={o.id}
                to="/look/$outfitId"
                params={{ outfitId: o.id }}
                className="tappable paper flex items-center gap-3 rounded-2xl p-3"
              >
                <div className="flex -space-x-3">
                  {itemsByIds(o.items, closet)
                    .slice(0, 3)
                    .map((it) => (
                      <img
                        key={it.id}
                        src={it.image}
                        alt={it.name}
                        loading="lazy"
                        className="h-12 w-12 rounded-xl border-2 border-card object-cover shadow-sm"
                      />
                    ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{o.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.caption}</p>
                </div>
                <span className="text-sm font-extrabold text-rose">View →</span>
              </Link>
            ))}
          </div>
        )}

        {building && !anchorsLoading && anchorOutfits.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Couldn't build a complete look — this piece may be missing compatible
            counterparts (e.g. shoes or bottoms) to pair with.
          </p>
        )}

        {!building && (
          <button
            onClick={() => setBuilding(true)}
            className="tappable mt-1 flex w-full items-center justify-center gap-2 rounded-3xl bg-rose py-4 text-sm font-extrabold text-primary-foreground"
          >
            <Sparkles size={18} /> Build looks around this
          </button>
        )}
      </section>
    </div>
  );
}
