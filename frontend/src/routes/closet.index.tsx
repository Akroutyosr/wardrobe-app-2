import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Euro, Plus } from "lucide-react";
import { categories, seasons } from "@/lib/closet-data";
import { useCloset, useColors } from "@/lib/use-wardrobe";
import { Sticker } from "@/components/scrapbook";
import { SafeImage } from "@/components/ui-bits";
import { ClosetDoors } from "@/components/closet-doors";
import { categoryColor } from "@/lib/palette";

export const Route = createFileRoute("/closet/")({
  head: () => ({
    meta: [
      { title: "My Closet · Twinish" },
      {
        name: "description",
        content:
          "Every piece you own, laid out like a scrapbook. Filter by category, colour and season.",
      },
      { property: "og:title", content: "My Closet · Twinish" },
      { property: "og:description", content: "Your whole wardrobe, calm and browsable." },
    ],
  }),
  component: Closet,
});

function Closet() {
  const [category, setCategory] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const { data: closet } = useCloset();
  const { data: colors } = useColors();
  const colorList = colors ?? [];
  const unpricedCount = useMemo(() => closet.filter((i) => i.price == null).length, [closet]);

  const items = useMemo(
    () =>
      closet.filter(
        (i) =>
          (!category || i.category === category) &&
          (!color || i.color === color) &&
          (!season || i.season.includes(season as never)),
      ),
    [closet, category, color, season],
  );

  const toggle = (val: string, cur: string | null, set: (v: string | null) => void) =>
    set(cur === val ? null : val);

  return (
    <div className="animate-float-in">
      <ClosetDoors />
      <header className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h1 className="display text-4xl">My closet</h1>
          <p className="mt-1 font-mono text-[0.66rem] uppercase tracking-[0.25em] text-muted-foreground">
            {items.length} pieces showing · all already yours
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {unpricedCount > 0 && (
            <Link
              to="/prices"
              className="tappable inline-flex items-center gap-1.5 rounded-full bg-maize px-3.5 py-2.5 text-xs font-extrabold text-ink shadow-polaroid"
              aria-label={`${unpricedCount} items still need a price`}
            >
              <Euro size={14} strokeWidth={2.6} /> {unpricedCount} unpriced
            </Link>
          )}
          <Link
            to="/add"
            className="tappable inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-2.5 text-sm font-extrabold text-primary-foreground shadow-lift"
          >
            <Plus size={17} strokeWidth={2.6} /> Add item
          </Link>
        </div>
      </header>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {categories.map((c) => (
          <Sticker
            key={c}
            selected={category === c}
            onClick={() => toggle(c, category, setCategory)}
          >
            {c}
          </Sticker>
        ))}
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {colorList.map((c) => (
          <Sticker
            key={c}
            tone="lilac"
            tilt={-1.5}
            selected={color === c}
            onClick={() => toggle(c, color, setColor)}
          >
            {c}
          </Sticker>
        ))}
      </div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {seasons.map((s) => (
          <Sticker
            key={s}
            tone="mint"
            tilt={1.5}
            selected={season === s}
            onClick={() => toggle(s, season, setSeason)}
          >
            {s}
          </Sticker>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl bg-card p-8 text-center shadow-polaroid">
          <p className="text-lg font-bold">Nothing matches that combo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try loosening a filter — there's plenty in here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item, idx) => (
            <Link
              key={item.id}
              to="/closet/$itemId"
              params={{ itemId: item.id }}
              className="tappable polaroid block p-2 transition-transform md:hover:scale-[1.02] md:hover:shadow-lg md:cursor-pointer"
            >
              <div className="relative">
                <SafeImage
                  src={item.image}
                  alt={item.name}
                  className="aspect-square w-full animate-develop rounded-[0.9rem] object-cover"
                  style={{ animationDelay: `${Math.min(idx, 11) * 70}ms` }}
                />
                {item.cpw != null && (
                  <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[0.65rem] font-extrabold text-rose backdrop-blur-sm">
                    €{item.cpw}/wear
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-1 pt-2">
                <p className="truncate text-sm font-bold leading-snug">{item.name}</p>
              </div>
              <div className="flex items-center justify-between gap-1 px-1 pb-1 pt-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide text-ink ${categoryColor[item.category]}`}
                >
                  {item.category}
                </span>
                <span className="text-[0.68rem] font-semibold text-muted-foreground">
                  worn {item.worn}×
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
