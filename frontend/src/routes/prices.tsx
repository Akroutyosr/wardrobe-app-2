import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Euro } from "lucide-react";
import { useCloset } from "@/lib/use-wardrobe";
import { setItemPrice } from "@/lib/api";

export const Route = createFileRoute("/prices")({
  head: () => ({
    meta: [
      { title: "Price sweep · Twinish" },
      {
        name: "description",
        content: "Type prices in one fast list and unlock cost-per-wear across your whole closet.",
      },
      { property: "og:title", content: "Price sweep · Twinish" },
      {
        property: "og:description",
        content: "Two seconds per piece — then every wear has a price.",
      },
    ],
  }),
  component: PriceSweep,
});

function PriceSweep() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: closet = [] } = useCloset();

  const unpriced = useMemo(() => closet.filter((i) => i.price == null), [closet]);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const filled = Object.entries(inputs).filter(([, v]) => v !== "" && !isNaN(parseFloat(v)));
  const pricedCount = closet.length - unpriced.length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(filled.map(([id, v]) => setItemPrice(id, parseFloat(v))));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closet"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      navigate({ to: "/closet" });
    },
  });

  return (
    <div className="animate-float-in pb-28">
      <header className="mb-5">
        <h1 className="display text-4xl">Price sweep</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {unpriced.length > 0 ? (
            <>
              {unpriced.length} piece{unpriced.length === 1 ? "" : "s"} without a price ·{" "}
              {pricedCount} already tagged with one
            </>
          ) : (
            <>Every single piece is priced. Impressive dedication.</>
          )}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-rose transition-all"
            style={{
              width: `${closet.length ? (pricedCount / closet.length) * 100 : 0}%`,
            }}
          />
        </div>
      </header>

      {unpriced.length === 0 ? (
        <div className="rounded-3xl bg-card p-8 text-center shadow-polaroid">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint text-mint-foreground">
            <Check size={32} strokeWidth={3} />
          </div>
          <p className="display mt-4 text-2xl">Sweep complete!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every item has a price — cost-per-wear is live across the closet.
          </p>
          <Link
            to="/closet"
            className="tappable mt-5 inline-block rounded-full bg-rose px-5 py-2.5 text-sm font-extrabold text-primary-foreground"
          >
            Back to my closet
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {unpriced.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 rounded-2xl bg-card p-2.5 shadow-polaroid"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  className="h-12 w-12 rounded-xl object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.name}</span>
                <span className="font-mono text-xs text-muted-foreground">worn {item.worn}×</span>
                <div className="flex items-center overflow-hidden rounded-xl border border-input focus-within:ring-2 focus-within:ring-ring">
                  <Euro size={13} className="ml-1.5 shrink-0 text-muted-foreground" />
                  <input
                    type="number"
                    value={inputs[item.id] ?? ""}
                    onChange={(e) => setInputs((cur) => ({ ...cur, [item.id]: e.target.value }))}
                    placeholder="—"
                    aria-label={`Price for ${item.name}`}
                    className="w-16 bg-transparent px-1 py-2 text-sm outline-none"
                  />
                </div>
              </label>
            ))}
          </div>

          {/* Sticky save bar */}
          <div className="fixed inset-x-0 bottom-4 z-30 mx-auto w-full max-w-[26rem] px-4">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={filled.length === 0 || saveMutation.isPending}
              className="tappable w-full rounded-full bg-rose py-3.5 text-sm font-extrabold text-primary-foreground shadow-lift disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveMutation.isPending
                ? "Saving…"
                : filled.length > 0
                  ? `Save ${filled.length} price${filled.length === 1 ? "" : "s"}`
                  : "Type a few prices to save"}
            </button>
          </div>
        </>
      )}

      {saveMutation.isError && (
        <p className="mt-3 text-center text-xs font-semibold text-destructive">
          Some prices didn&apos;t save — check your connection and try again.
        </p>
      )}
    </div>
  );
}
