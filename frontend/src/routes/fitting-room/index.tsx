import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Download, Loader2, RotateCcw, Shirt, Trash2 } from "lucide-react";
import { useCloset, useOutfits, useSavedOutfits, itemsByIds } from "@/lib/use-wardrobe";
import {
  deleteSavedFittingPhoto,
  getSavedFittingPhoto,
  getTryOnSession,
  startTryOn,
  type TryOnSession,
} from "@/lib/api";
import { deviceId } from "@/lib/utils";
import { categoryColor } from "@/lib/palette";

export const Route = createFileRoute("/fitting-room/")({
  validateSearch: (search: { photo?: unknown }) => {
    const photo = typeof search["photo"] === "string" ? search["photo"] : null;
    return photo ? { photo } : {};
  },
  head: () => ({
    meta: [
      { title: "Fitting Room · Twinish" },
      {
        name: "description",
        content:
          "Upload a full-length photo, pick an outfit from your closet, and see it on you with IDM-VTON virtual try-on.",
      },
      { property: "og:title", content: "Fitting Room · Twinish" },
      { property: "og:description", content: "Try on your own closet, virtually." },
    ],
  }),
  component: FittingRoom,
});

type Stage = "start" | "trying" | "result" | "error";

function FittingRoom() {
  const { photo } = Route.useSearch();
  const { data: closet } = useCloset();
  const { data: savedOutfits } = useSavedOutfits();
  const hasSaved = (savedOutfits?.length ?? 0) > 0;
  // Prefer saved (favorited) looks for try-on — those are the ones the user
  // actually cares about — and only hit the slow Gemini generator for a fresh
  // deck before anyone has saved anything.
  const { data: deckOutfits } = useOutfits({ notes: "fitting room" }, !hasSaved);
  const outfits = hasSaved ? (savedOutfits ?? []) : (deckOutfits ?? []);

  const [photoPath, setPhotoPath] = useState<string | null>(photo ?? null);
  const [checkingSaved, setCheckingSaved] = useState(!photo);
  const [outfitId, setOutfitId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("start");
  const [session, setSession] = useState<TryOnSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedPhoto, setHasSavedPhoto] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Returning-user flow: if a saved photo exists and the visitor hasn't just
  // uploaded a fresh one, skip the capture step and start at outfit choice.
  useEffect(() => {
    if (!checkingSaved) return;
    let cancelled = false;
    (async () => {
      const saved = await getSavedFittingPhoto(deviceId());
      if (cancelled) return;
      if (saved) {
        setPhotoPath(saved.image_path);
        setHasSavedPhoto(true);
      }
      setCheckingSaved(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkingSaved]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const tryItOn = async () => {
    if (!outfitId || !photoPath) return;
    setStage("trying");
    setError(null);
    setSession(null);
    try {
      const { session_id } = await startTryOn(outfitId, photoPath, deviceId());
      const poll = () =>
        void (async () => {
          const s = await getTryOnSession(session_id);
          setSession(s);
          if (s.status === "complete") {
            stopPolling();
            setStage("result");
          } else if (s.status === "failed") {
            stopPolling();
            setStage("error");
            setError("The try-on service hit a snag. Give it a moment and try again.");
          }
        })();
      poll();
      pollRef.current = setInterval(poll, 4000);
    } catch (e) {
      setStage("error");
      setError(`Couldn't start the try-on: ${String(e)}`);
    }
  };

  const reset = () => {
    stopPolling();
    setStage("start");
    setOutfitId(null);
    setSession(null);
  };

  const removePhoto = async () => {
    try {
      await deleteSavedFittingPhoto(deviceId());
    } finally {
      setPhotoPath(null);
      setHasSavedPhoto(false);
      reset();
    }
  };

  const selectedOutfit = outfits.find((o) => o.id === outfitId) ?? null;
  const selectedItems = selectedOutfit ? itemsByIds(selectedOutfit.items, closet) : [];

  const resultUrl = session?.result_image_path
    ? session.result_image_path.startsWith("http")
      ? session.result_image_path
      : `${window.location.origin}${session.result_image_path}`
    : null;

  return (
    <div className="animate-float-in">
      <header className="mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blossom px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-widest text-ink">
          <Shirt size={12} /> virtual try-on
        </span>
        <h1 className="display mt-2 text-4xl">Fitting room</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a look, see it on you — composited one garment at a time.
        </p>
      </header>

      {/* Photo step */}
      {stage === "start" && (
        <div className="space-y-4 lg:flex lg:flex-row lg:items-start lg:gap-8">
          <section className="rounded-4xl bg-card p-5 shadow-lift lg:sticky lg:top-8 lg:w-1/2 lg:shrink-0">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
              1 · Your photo
            </h2>
            {photoPath ? (
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
                <span className="text-sm font-bold">Full-body photo ready ✓</span>
                <div className="flex gap-2">
                  <Link
                    to="/fitting-room/capture"
                    className="tappable rounded-full bg-card px-3 py-1.5 text-xs font-bold"
                  >
                    Use different photo
                  </Link>
                  {hasSavedPhoto && (
                    <button
                      onClick={removePhoto}
                      className="tappable rounded-full bg-card px-3 py-1.5 text-xs font-bold text-rose"
                    >
                      <Trash2 size={12} className="mr-1 inline" /> Delete saved
                    </button>
                  )}
                </div>
              </div>
            ) : checkingSaved ? (
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                <Loader2 className="mr-1 inline animate-spin" size={14} /> Checking for a saved
                photo…
              </p>
            ) : (
              <Link
                to="/fitting-room/capture"
                className="tappable mt-3 flex items-center justify-center gap-2 rounded-2xl bg-rose py-4 text-sm font-extrabold text-primary-foreground"
              >
                <Camera size={18} /> Add a full-length photo
              </Link>
            )}
          </section>

          <div className="space-y-4 lg:mt-0 lg:min-w-0 lg:flex-1">
          <section className="rounded-4xl bg-card p-5 shadow-lift">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
              2 · Pick the look
            </h2>
            {outfits.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                {hasSaved ? (
                  <>No saved looks to try on — save some from the Ideas page first.</>
                ) : (
                  <>No looks yet — generate one on the home screen first.</>
                )}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {outfits.slice(0, 6).map((o) => {
                  const items = itemsByIds(o.items, closet);
                  const active = outfitId === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setOutfitId(o.id)}
                      className={`tappable flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${
                        active ? "bg-rose text-primary-foreground" : "bg-secondary"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {items[0]?.image && (
                          <img
                            src={items[0].image}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-xl object-cover"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{o.title}</span>
                          <span className="block text-xs opacity-75">
                            {items.map((i) => i.name).join(", ") || o.id}
                          </span>
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide ${
                          active ? "bg-card/30" : categoryColor[items[0]?.category ?? "tops"]
                        }`}
                      >
                        {items.length} pcs
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <button
            onClick={tryItOn}
            disabled={!outfitId || !photoPath}
            className="tappable flex w-full items-center justify-center gap-2 rounded-3xl bg-rose py-4 text-sm font-extrabold text-primary-foreground disabled:opacity-40"
          >
            <Shirt size={17} /> Try it on
          </button>
        </div>
        </div>
      )}

      {/* Progress */}
      {stage === "trying" && session && (
        <section className="rounded-4xl bg-card p-8 text-center shadow-lift">
          <div className="mx-auto h-16 w-16 animate-breathe rounded-full bg-maize text-3xl leading-[4rem]">
            🧵
          </div>
          <h2 className="display mt-4 text-3xl">
            {session.total_steps
              ? `Fitting ${Math.max(session.current_step, 1)} of ${session.total_steps}`
              : "Fitting…"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each garment gets composited one at a time — this can take a few minutes.
          </p>
          <div className="mx-auto mt-5 h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-rose transition-all duration-500"
              style={{
                width: `${
                  session.total_steps
                    ? Math.min(100, ((session.current_step + 1) / session.total_steps) * 100)
                    : 30
                }%`,
              }}
            />
          </div>
          <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            hold tight — hanging on a wire
          </p>
        </section>
      )}

      {/* Result */}
      {stage === "result" && (
        <div className="space-y-4">
          <section className="rounded-4xl bg-card p-5 shadow-lift">
            <h2 className="display text-2xl">On you ✨</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every garment composited in order. Here&apos;s the full look.
            </p>
            {resultUrl ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="overflow-hidden rounded-3xl bg-muted p-2">
                  <img
                    src={
                      photoPath
                        ? photoPath.startsWith("http")
                          ? photoPath
                          : `${window.location.origin}${photoPath}`
                        : ""
                    }
                    alt="Before"
                    className="w-full rounded-2xl"
                  />
                  <p className="pt-2 text-center font-mono text-[0.65rem] font-bold uppercase">
                    before
                  </p>
                </div>
                <div className="overflow-hidden rounded-3xl bg-muted p-2">
                  <img src={resultUrl} alt="After" className="w-full rounded-2xl" />
                  <p className="pt-2 text-center font-mono text-[0.65rem] font-bold uppercase text-rose">
                    after
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold text-muted-foreground">
                Result image is missing.
              </p>
            )}
          </section>

          <div className="flex gap-2">
            <a
              href={resultUrl ?? "#"}
              download
              className="tappable flex flex-1 items-center justify-center gap-2 rounded-2xl bg-maize py-3.5 text-sm font-extrabold text-ink"
            >
              <Download size={17} /> Download
            </a>
            <button
              onClick={reset}
              className="tappable flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3.5 text-sm font-extrabold shadow-polaroid"
            >
              <RotateCcw size={16} /> Another look
            </button>
          </div>
        </div>
      )}

      {stage === "error" && (
        <section className="rounded-4xl bg-card p-8 text-center shadow-lift">
          <p className="text-lg font-bold">Couldn&apos;t finish the try-on</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error ?? "The virtual try-on service is a shared free resource and can be busy."}
          </p>
          <button
            onClick={reset}
            className="tappable mt-4 rounded-full bg-rose px-5 py-2 text-sm font-extrabold text-primary-foreground"
          >
            Try again
          </button>
          <Link to="/" className="mt-3 block text-xs font-bold text-muted-foreground underline">
            Back to home
          </Link>
        </section>
      )}
    </div>
  );
}
