import { useState, useEffect } from "react";

/**
 * Double closet doors that slide open on mount to reveal the wardrobe behind.
 * Renders two fixed overlays that translate apart, then unmounts itself.
 * Respects reduced-motion: doors simply disappear.
 */
export function ClosetDoors() {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setOpen(true), 80);
    const t2 = setTimeout(() => setGone(true), 950);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 flex"
      style={{ animation: "fade-fast 0.2s 0.9s both" }}
    >
      {/* left door */}
      <div
        className="relative h-full w-1/2 origin-left"
        style={{
          background: "linear-gradient(135deg, var(--muted) 0%, var(--card) 100%)",
          transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          transform: open ? "translateX(-100%)" : "translateX(0)",
        }}
      >
        {/* wood grain stripes */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 18px, currentColor 18px, currentColor 19px)",
          }}
        />
        {/* bevel shadow on opening edge */}
        <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/10 to-transparent" />
        {/* handle */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
          <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-600 shadow-md" />
          <div className="h-1 w-1 rounded-full bg-amber-500" />
        </div>
      </div>

      {/* right door */}
      <div
        className="relative h-full w-1/2 origin-right"
        style={{
          background: "linear-gradient(225deg, var(--muted) 0%, var(--card) 100%)",
          transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          transform: open ? "translateX(100%)" : "translateX(0)",
        }}
      >
        {/* wood grain stripes */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 18px, currentColor 18px, currentColor 19px)",
          }}
        />
        {/* bevel shadow on opening edge */}
        <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/10 to-transparent" />
        {/* handle */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
          <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-600 shadow-md" />
          <div className="h-1 w-1 rounded-full bg-amber-500" />
        </div>
      </div>
    </div>
  );
}
