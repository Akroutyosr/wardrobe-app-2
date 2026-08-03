import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { itemNotes } from "@/lib/twinish-data";
import { useCloset, useItem, useOutfits, itemsByIds } from "@/lib/use-wardrobe";
import { Badge } from "@/components/ui-bits";
import { Callout, ArrowNote, WashiTape } from "@/components/scrapbook";

export const Route = createFileRoute("/closet/$itemId")({
  head: () => ({
    meta: [
      { title: "Item card · Threadit" },
      {
        name: "description",
        content:
          "A polaroid item card: main photo, detail shots, arrow callouts on the fabric and construction, plus every outfit it appears in.",
      },
      { property: "og:title", content: "Item card · Threadit" },
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
  const { data: item } = useItem(itemId);
  const { data: closet } = useCloset();
  const { data: outfits } = useOutfits();

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
    outfits.filter((o) => o.items.includes(item.id)).flatMap((o) => o.items),
    closet,
  ).slice(0, 3);
  const itemSummary = item.name;

  return (
    <div className="animate-float-in">
      <Link
        to="/closet"
        className="tappable mb-4 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-polaroid"
      >
        <ArrowLeft size={15} /> Closet
      </Link>

      <section className="kraft relative overflow-hidden rounded-3xl p-4 pt-7">
        <WashiTape className="-right-7 top-4 w-32 rotate-[20deg]" />
        <p className="handwritten absolute left-6 top-1 text-3xl">no. {item.id}</p>

        <div className="relative">
          <div className="polaroid animate-print p-2.5">
            <img src={item.image} alt={item.name} className="w-full rounded-2xl object-cover" />
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

      <p className="handwritten mt-4 text-2xl leading-snug text-foreground/80">{item.note}</p>

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
    </div>
  );
}
