import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCloset } from "@/lib/use-wardrobe";
import { quickLogWear } from "@/lib/api";
import { markLoggedToday } from "@/lib/habit-nudge";

const CATEGORIES = ["top", "bottom", "shoes", "outerwear", "accessory"] as const;

const RATING_OPTIONS = [
  { value: 2, emoji: "😐", label: "Meh" },
  { value: 3, emoji: "🙂", label: "Fine" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "😍", label: "Love it" },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  preselectedItemIds?: string[]; // from auto-suggest
};

export function QuickLog({ isOpen, onClose, preselectedItemIds = [] }: Props) {
  const queryClient = useQueryClient();
  const { data: closet = [] } = useCloset();

  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedItemIds);
  const [rating, setRating] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("top");
  const [step, setStep] = useState<"pick" | "rate">("pick");

  // The suggestion arrives after mount (async fetch), and the sheet must open
  // fresh every time -- so re-seed whenever it's closed.
  const preselectKey = preselectedItemIds.join(",");
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(preselectedItemIds);
      setRating(null);
      setStep("pick");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preselectKey]);

  const logMutation = useMutation({
    mutationFn: () => quickLogWear(selectedIds, rating ?? 3),
    onSuccess: () => {
      markLoggedToday();
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["closet"] });
      queryClient.invalidateQueries({ queryKey: ["planner/week"] });
      queryClient.invalidateQueries({ queryKey: ["outfits"] });
      onClose();
    },
  });

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filteredItems = closet.filter((i) => i.category === activeCategory);
  // Backend categories ("top"/"bottom"/…) ride through ClosetItem as a cast,
  // so compare as plain strings rather than the mock data's Category union.
  const selectedCategories = new Set<string>(
    selectedIds.flatMap((id) => {
      const cat = closet.find((i) => i.id === id)?.category;
      return cat ? [String(cat)] : [];
    }),
  );
  const hasMinimum =
    (selectedCategories.has("top") && selectedCategories.has("bottom")) ||
    selectedCategories.has("dress");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-4xl bg-card p-6 shadow-lift">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-xl">What did you wear?</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground">
            Cancel
          </button>
        </div>

        {step === "pick" && (
          <>
            {/* Category tabs */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    activeCategory === cat
                      ? "bg-rose text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Item grid */}
            <div className="mb-4 grid flex-1 grid-cols-3 gap-2 overflow-y-auto">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  aria-label={item.name}
                  className={`relative aspect-square overflow-hidden rounded-2xl border-2 transition-all ${
                    selectedIds.includes(item.id) ? "scale-95 border-rose" : "border-transparent"
                  }`}
                >
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  {selectedIds.includes(item.id) && (
                    <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose">
                      <span className="text-xs text-primary-foreground">✓</span>
                    </div>
                  )}
                </button>
              ))}
              {filteredItems.length === 0 && (
                <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">
                  No {activeCategory} items in your closet yet
                </p>
              )}
            </div>

            {/* Selected count + next */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedIds.length} item{selectedIds.length !== 1 ? "s" : ""} selected
              </p>
              <button
                onClick={() => setStep("rate")}
                disabled={!hasMinimum}
                className="rounded-full bg-rose px-6 py-2.5 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Rate this look →
              </button>
            </div>
            {!hasMinimum && selectedIds.length > 0 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Pick at least a top and a bottom (or just a dress)
              </p>
            )}
          </>
        )}

        {step === "rate" && (
          <div className="flex flex-col items-center gap-6 py-4">
            <p className="text-sm text-muted-foreground">How did you feel in this outfit?</p>

            <div className="flex gap-4">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRating(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-2xl p-3 transition-all ${
                    rating === opt.value ? "scale-110 bg-blush" : "hover:bg-muted"
                  }`}
                >
                  <span className="text-3xl">{opt.emoji}</span>
                  <span className="text-xs text-muted-foreground">{opt.label}</span>
                </button>
              ))}
            </div>

            {logMutation.isError && (
              <p className="text-xs font-semibold text-destructive">
                Couldn&apos;t save that — check your connection and try again.
              </p>
            )}

            <div className="flex w-full gap-3">
              <button
                onClick={() => setStep("pick")}
                className="flex-1 rounded-full border border-border py-3 text-sm font-bold text-muted-foreground"
              >
                ← Back
              </button>
              <button
                onClick={() => logMutation.mutate()}
                disabled={!rating || logMutation.isPending}
                className="flex-1 rounded-full bg-rose py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-40"
              >
                {logMutation.isPending ? "Saving…" : "Log outfit ✓"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
