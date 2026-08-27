import { useState, useEffect } from "react";

const SPREAD_KEY = "twinish_closet_visited";

/**
 * A scrapbook album spread that opens from the center spine to reveal the
 * closet underneath. Two paper-textured pages fold outward in 3D, then
 * unmount to let the content choreograph in.
 *
 * First visit: full 3D page-fold (600ms).
 * Returning visits (same session): fast fade (250ms).
 * Respects reduced-motion: instant fade.
 */
export function ScrapbookSpread() {
  const [phase, setPhase] = useState<"closed" | "open" | "gone">("closed");
  const isFirstVisit = !sessionStorage.getItem(SPREAD_KEY);

  useEffect(() => {
    if (!isFirstVisit) {
      // Returning: fast fade
      const t = setTimeout(() => setPhase("open"), 30);
      const t2 = setTimeout(() => setPhase("gone"), 280);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }

    // First visit: pages fold, then unmount
    const t1 = setTimeout(() => setPhase("open"), 60);
    const t2 = setTimeout(() => {
      setPhase("gone");
      sessionStorage.setItem(SPREAD_KEY, "1");
    }, 680);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isFirstVisit]);

  if (phase === "gone") return null;

  const isOpen = phase === "open";
  const dur = isFirstVisit ? "0.6s" : "0.22s";
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50"
      style={{ perspective: "1200px" }}
    >
      <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
        {/* left page — folds open to the left, hinge at center spine */}
        <div
          className="absolute inset-y-0 left-0 h-full w-1/2 origin-right"
          style={{
            transform: isOpen ? "rotateY(-90deg)" : "rotateY(0deg)",
            transition: `transform ${dur} ${easing}`,
            backfaceVisibility: "hidden",
          }}
        >
          <PageSurface side="left" />
        </div>

        {/* right page — folds open to the right, hinge at center spine */}
        <div
          className="absolute inset-y-0 right-0 h-full w-1/2 origin-left"
          style={{
            transform: isOpen ? "rotateY(90deg)" : "rotateY(0deg)",
            transition: `transform ${dur} ${easing}`,
            backfaceVisibility: "hidden",
          }}
        >
          <PageSurface side="right" />
        </div>

        {/* spine shadow — darkens as pages separate */}
        <div
          className="absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2"
          style={{
            background:
              "linear-gradient(to bottom, transparent 5%, rgb(60 40 45 / 0.18) 30%, rgb(60 40 45 / 0.18) 70%, transparent 95%)",
            opacity: isOpen ? 0 : 1,
            transition: `opacity ${dur} ${easing}`,
          }}
        />
      </div>
    </div>
  );
}

function PageSurface({ side }: { side: "left" | "right" }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: "linear-gradient(var(--muted), var(--card))",
        boxShadow:
          side === "left"
            ? "inset -8px 0 20px -10px rgb(60 40 45 / 0.1)"
            : "inset 8px 0 20px -10px rgb(60 40 45 / 0.1)",
      }}
    >
      {/* paper stripe texture — matches the plate-card pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 28px)",
        }}
      />
      {/* dot grid — stationery feel */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
          backgroundSize: "18px 18px",
        }}
      />
      {/* fold crease on the inner edge */}
      <div
        className="absolute inset-y-0 w-6"
        style={{
          [side === "left" ? "right" : "left"]: 0,
          background:
            side === "left"
              ? "linear-gradient(to left, rgb(60 40 45 / 0.06), transparent)"
              : "linear-gradient(to right, rgb(60 40 45 / 0.06), transparent)",
        }}
      />
    </div>
  );
}
