import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ShoppingBag, RotateCcw, Sparkles } from "lucide-react";
import { useCloset } from "@/lib/use-wardrobe";
import { shouldIBuy, type VerdictResult } from "@/lib/api";
import { Confetti } from "@/components/Confetti";
import { Stamp, Barcode, DashRule } from "@/components/scrapbook";
import { categoryColor } from "@/lib/palette";
import candidate from "@/assets/item-blazer.jpg";

export const Route = createFileRoute("/should-i-buy")({
  validateSearch: (search: { hint?: unknown }) => {
    const hint = typeof search["hint"] === "string" ? search["hint"] : null;
    return hint ? { hint } : {};
  },
  head: () => ({
    meta: [
      { title: "Should I Buy This? · Twinish" },
      {
        name: "description",
        content:
          "Snap the thing you're eyeing and get an itemised receipt verdict — APPROVED, MAYBE or SKIP — based on what's already hanging in your closet.",
      },
      { property: "og:title", content: "Should I Buy This? · Twinish" },
      {
        property: "og:description",
        content: "A receipt-style second opinion before you buy. Warm, honest, never shamey.",
      },
    ],
  }),
  component: ShouldIBuy,
});

type Stage = "start" | "loading" | "verdict";

function ShouldIBuy() {
  const { hint } = Route.useSearch();
  const [stage, setStage] = useState<Stage>("start");
  const [fire, setFire] = useState(0);
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [price, setPrice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: closet } = useCloset();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setStage("loading");
    try {
      const result = await shouldIBuy(file, price ? parseFloat(price) : undefined);
      setVerdict(result);
      setStage("verdict");
      setFire((f) => f + 1);
    } catch (err) {
      console.warn("Agent unavailable, showing demo verdict:", err);
      setVerdict(null);
      setStage("verdict");
      setFire((f) => f + 1);
    }
  };

  const markup = parseVerdict(verdict?.verdict) ?? "maybe";
  const stamp: "APPROVED" | "MAYBE" | "SKIP" =
    markup === "buy" ? "APPROVED" : markup === "skip" ? "SKIP" : "MAYBE";

  const pairs = verdict ? (
    <>
      {(findPairs(verdict) ?? []).slice(0, 4).map((p) => {
        const item = closet.find((i) => i.id === p.id);
        if (!item) return null;
        return (
          <Link
            key={p.id}
            to="/closet/$itemId"
            params={{ itemId: p.id }}
            className={`tappable flex items-center justify-between rounded-xl px-3 py-2 text-ink ${categoryColor[item.category]}`}
          >
            <span className="text-[0.72rem] font-extrabold uppercase">{item.name}</span>
            <span className="text-[0.62rem] font-bold uppercase tracking-widest opacity-75">
              {item.category} · owned
            </span>
          </Link>
        );
      })}
    </>
  ) : null;

  return (
    <div className="relative animate-float-in">
      <Confetti fire={fire} />

      <header className="mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-maize px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-widest text-ink">
          <Sparkles size={12} /> the big decision helper
        </span>
        <h1 className="display mt-2 text-4xl">Should I buy this?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Standing in the shop? Show us the thing — we'll print you a verdict.
        </p>
      </header>

      {stage === "start" && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {hint && (
            <p className="mb-3 rounded-2xl bg-card px-4 py-3 text-center text-sm font-bold italic text-muted-foreground shadow-polaroid">
              Cupboard reminder — you came looking for something like a{" "}
              <span className="text-rose">{hint.toLowerCase()}</span>. Snap what you&apos;re eyeing.
            </p>
          )}

          {/* Optional price turns on the cost-per-wear projection in the verdict */}
          <div className="mb-3 flex items-center justify-center gap-2">
            <label
              htmlFor="buy-price"
              className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
            >
              optional: what does it cost?
            </label>
            <div className="flex items-center overflow-hidden rounded-xl border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
              <span className="px-2 font-mono text-sm text-muted-foreground">EUR</span>
              <input
                id="buy-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-20 bg-transparent py-2 pr-2 text-sm outline-none"
              />
            </div>
          </div>

          <button
            onClick={() => fileInput.current?.click()}
            className="tappable relative w-full overflow-hidden rounded-4xl bg-rose p-8 text-center text-primary-foreground shadow-lift"
          >
            <span className="mx-auto flex h-24 w-24 animate-breathe items-center justify-center rounded-full bg-card text-rose shadow-lift">
              <ShoppingBag size={44} strokeWidth={2.3} />
            </span>
            <span className="display mt-5 block text-3xl">Snap the tempting thing</span>
            <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-widest opacity-85">
              checked against everything you own
            </span>
          </button>
        </>
      )}

      {stage === "loading" && (
        <div className="rounded-4xl bg-card p-10 text-center shadow-polaroid">
          <div className="mx-auto h-16 w-16 animate-breathe rounded-full bg-maize text-3xl leading-[4rem]">
            🛍️
          </div>
          <p className="display mt-5 text-3xl">Running the numbers…</p>
          <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            tagging it, checking for duplicates, scoring versatility
          </p>
          <div className="mx-auto mt-5 h-2 w-44 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-rose" />
          </div>
        </div>
      )}

      {stage === "verdict" && (
        <div className="w-full space-y-5 md:mx-auto md:max-w-md">
          <div className="receipt animate-print relative px-6 py-7">
            <div className="text-center">
              <p className="display text-3xl">Twinish</p>
              <p className="text-[0.65rem] uppercase tracking-[0.3em]">closet audit receipt</p>
              <p className="mt-1 text-[0.65rem]">verdict on the thing you're eyeing</p>
            </div>

            <DashRule />

            <div className="space-y-2 text-[0.8rem]">
              <div className="flex justify-between font-bold">
                <span>1× {verdict ? itemSummary(verdict) : "THE TEMPTING THING"}</span>
              </div>
              <p className="pl-3 text-[0.7rem] opacity-70">the tempting thing</p>

              <p className="pt-2 text-[0.7rem] uppercase tracking-widest opacity-70">pairs with</p>
              {pairs ?? (
                <p className="pl-3 text-[0.7rem] opacity-70">(agent unavailable — demo copy)</p>
              )}

              <div className="flex justify-between pt-2 text-[0.7rem]">
                <span>VERSATILITY</span>
                <span>
                  {verdict
                    ? `${versatilityCount(verdict)} pieces match`
                    : "checked against your closet"}
                </span>
              </div>
            </div>

            <DashRule />

            <div className="flex justify-center py-3">
              <Stamp verdict={stamp} />
            </div>

            <DashRule />

            <p className="text-center text-[0.75rem] leading-relaxed">{justification(verdict)}</p>

            <Barcode className="mt-5" />
            <p className="mt-2 text-center text-[0.6rem] uppercase tracking-widest opacity-60">
              thank you for shopping your own closet first
            </p>
          </div>

          <div className="relative rounded-3xl bg-card p-5 shadow-polaroid">
            <h2 className="display text-2xl">One gentle heads-up 🤔</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {verdict
                ? "Read the reasoning below — it's grounded in what your agent actually found in your wardrobe."
                : "You own something in this family already. Still different enough to earn its hanger — worth a side-by-side."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="overflow-hidden rounded-3xl bg-sky p-2 text-ink">
                <img
                  src={closet[0]?.image ?? candidate}
                  alt="Your twin piece"
                  className="w-full rounded-2xl"
                  loading="lazy"
                />
                <p className="px-1 pt-2 font-mono text-[0.65rem] font-bold">
                  YOURS · WORN {closet[0]?.worn ?? 0}×
                </p>
              </div>
              <div className="overflow-hidden rounded-3xl bg-blossom p-2 text-ink">
                <img
                  src={candidate}
                  alt="The new one"
                  className="w-full rounded-2xl"
                  loading="lazy"
                />
                <p className="px-1 pt-2 font-mono text-[0.65rem] font-bold">NEW · TAGGED</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setVerdict(null);
              setStage("start");
            }}
            className="tappable flex w-full items-center justify-center gap-2 rounded-3xl bg-rose py-4 text-sm font-extrabold text-primary-foreground"
          >
            <RotateCcw size={16} /> Check something else
          </button>
        </div>
      )}
    </div>
  );
}

function parseVerdict(text?: string): "buy" | "skip" | "maybe" | undefined {
  if (!text) return undefined;
  const m = text.match(/^Verdict:\s*(buy|skip|maybe)/i);
  const g = m?.[1];
  return g ? (g.toLowerCase() as "buy" | "skip" | "maybe") : undefined;
}

function justification(v: VerdictResult | null): string {
  if (!v)
    return "It fills a real gap in your closet and plays nicely with your most-worn pieces. Buy it — wear it soon.";
  const body = v.verdict.replace(/^Verdict:\s*(buy|skip|maybe)\s*/i, "").trim();
  return body || "The agent checked your closet before answering.";
}

function findPairs(
  v: VerdictResult | null,
): { id: string; category: string; subcategory: string }[] {
  const call = v?.tool_log.find((t) => t.name === "compute_versatility_score");
  return call?.result.pairs_with ?? [];
}

function versatilityCount(v: VerdictResult | null): number {
  const call = v?.tool_log.find((t) => t.name === "compute_versatility_score");
  return call?.result.versatility_score ?? 0;
}

function itemSummary(v: VerdictResult): string {
  return (
    [v.new_item.primary_color, v.new_item.subcategory].filter(Boolean).join(" ").toUpperCase() ||
    "THE TEMPTING THING"
  );
}
