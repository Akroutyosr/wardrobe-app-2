import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, Check, Plus } from "lucide-react";
import { Sticker } from "@/components/scrapbook";
import { Confetti } from "@/components/Confetti";
import { addItem, uploadPhoto, type Tags } from "@/lib/api";
import { useCloset } from "@/lib/use-wardrobe";

export const Route = createFileRoute("/add")({
  head: () => ({
    meta: [
      { title: "Add an Item · Twinish" },
      {
        name: "description",
        content:
          "Snap a photo and Twinish tags it for you — colour, season and vibe, all editable.",
      },
      { property: "og:title", content: "Add an Item · Twinish" },
      { property: "og:description", content: "Add a piece to your closet in a few happy taps." },
    ],
  }),
  component: AddItem,
});

const fallbackSuggested = ["cream", "knit", "cardigan", "fall", "cozy casual", "layering"];

type Stage = "start" | "loading" | "review" | "done";

type Reviewed = {
  imageUrl: string;
  imagePath: string;
  seasons: string[];
  tags: Tags;
};

function AddItem() {
  const [stage, setStage] = useState<Stage>("start");
  const [reviewed, setReviewed] = useState<Reviewed | null>(null);
  const [keptSeasons, setKeptSeasons] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fire, setFire] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const closetQuery = useCloset();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setStage("loading");
    setError(null);
    try {
      const result = await uploadPhoto(file);
      const seasons = Array.isArray(result.tags.seasons) ? result.tags.seasons : [];
      setReviewed({
        imageUrl: URL.createObjectURL(file),
        imagePath: result.image_path,
        seasons,
        tags: result.tags,
      });
      setKeptSeasons(seasons);
      setStage("review");
    } catch (err) {
      // Tagging is required to add an item — never pretend it worked. Show an
      // honest error with a retry instead of demo tags that can't be saved.
      console.warn("Tagging unavailable:", err);
      setError(
        "Couldn't tag that photo — the styling service is unreachable right now. Check your connection and try again.",
      );
      setStage("start");
    }
  };

  const save = async () => {
    if (!reviewed || !reviewed.imagePath) return;
    const tags = { ...reviewed.tags, seasons: keptSeasons };
    setSaving(true);
    try {
      await addItem(reviewed.imagePath, tags, price ? parseFloat(price) : undefined);
      closetQuery.refetch();
      setSaving(false);
      setStage("done");
      setFire((f) => f + 1);
    } catch (err) {
      console.warn("Saving to wardrobe failed:", err);
      setSaving(false);
      setError(
        "The tags look good but the closet didn't accept the save — check your connection and try again.",
      );
    }
  };

  const chipList = reviewed
    ? [
        reviewed.tags.primary_color,
        reviewed.tags.subcategory,
        reviewed.tags.category,
        reviewed.tags.pattern,
        reviewed.tags.fabric_guess,
      ]
        .filter((v): v is string => Boolean(v))
        .slice(0, 6)
    : fallbackSuggested;

  const toggleSeason = (s: string) =>
    setKeptSeasons((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <div className="relative animate-float-in">
      <Confetti fire={fire} />
      <header className="mb-6">
        <h1 className="display text-4xl">Add something new</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One photo is all we need — we'll handle the boring tagging part.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {stage === "start" && (
        <div className="rounded-3xl bg-card p-6 text-center shadow-lift">
          <button
            onClick={() => fileInput.current?.click()}
            className="tappable mx-auto flex h-32 w-32 animate-breathe items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift"
            aria-label="Take a photo"
          >
            <Plus size={54} strokeWidth={2.5} />
          </button>
          <p className="mt-5 text-base font-bold">Snap it or upload it</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Flat on the bed works great. No styling needed, promise.
          </p>
          <button
            onClick={() => fileInput.current?.click()}
            className="tappable mt-5 inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground"
          >
            <Camera size={18} /> Use camera
          </button>
        </div>
      )}

      {stage === "loading" && (
        <div className="rounded-3xl bg-card p-10 text-center shadow-lift">
          <div className="mx-auto h-16 w-16 animate-breathe rounded-full bg-blush text-3xl leading-[4rem]">
            👀
          </div>
          <p className="mt-5 text-lg font-bold">Studying your fit...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Checking the colour, texture and vibe.
          </p>
          <div className="mx-auto mt-5 h-2 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}

      {stage === "review" && reviewed && (
        <div className="animate-pop rounded-3xl bg-card p-5 shadow-lift">
          <img
            src={reviewed.imageUrl}
            alt="Newly added item"
            className="w-full rounded-2xl object-cover"
          />
          <p className="mt-4 text-base font-bold">Here's what we spotted 🌼</p>
          <p className="text-sm text-muted-foreground">
            Check the tags, then add it to your closet.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {chipList.map((t) => (
              <Sticker key={t} selected>
                {t}
              </Sticker>
            ))}
          </div>

          <p className="mt-4 text-sm font-bold">Seasons it works for</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["spring", "summer", "fall", "winter"] as const).map((s) => (
              <Sticker key={s} selected={keptSeasons.includes(s)} onClick={() => toggleSeason(s)}>
                {s}
              </Sticker>
            ))}
          </div>

          {/* Price right after tagging — the moment it's still fresh. Optional,
              but every price powers the cost-per-wear tracker later. */}
          <p className="mt-4 text-sm font-bold">What did it cost? 💶</p>
          <p className="text-xs text-muted-foreground">
            Optional — but it unlocks cost-per-wear for this piece.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
              <span className="px-2.5 font-mono text-sm text-muted-foreground">EUR</span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-24 bg-transparent py-2 pr-2 text-sm outline-none"
              />
            </div>
            {price && (
              <button
                onClick={() => setPrice("")}
                className="text-xs font-bold text-muted-foreground"
              >
                clear
              </button>
            )}
          </div>

          {saving && (
            <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
              Saving — hang on a moment
            </p>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="tappable mt-5 w-full rounded-3xl bg-primary py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Adding to your closet…" : "Add to my closet"}
          </button>
        </div>
      )}

      {stage === "done" && (
        <div className="animate-pop rounded-3xl bg-card p-8 text-center shadow-lift">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mint text-mint-foreground">
            <Check size={40} strokeWidth={3} />
          </div>
          <h2 className="mt-5 text-2xl font-bold">Added to your closet! 🎉</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            It's tagged and embedded in your wardrobe now.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              to="/ideas"
              className="tappable rounded-3xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
            >
              See outfit ideas
            </Link>
            <button
              onClick={() => {
                setStage("start");
                setReviewed(null);
                setPrice("");
              }}
              className="tappable rounded-3xl bg-secondary py-3.5 text-sm font-bold text-secondary-foreground"
            >
              Add another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
