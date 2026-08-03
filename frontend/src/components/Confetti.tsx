import { useEffect, useState } from "react";

const palette = ["bg-primary", "bg-lilac", "bg-mint", "bg-butter", "bg-accent"];

export function Confetti({ fire }: { fire: number }) {
  const [pieces, setPieces] = useState<
    { id: number; left: number; dx: number; dy: number; rot: number; delay: number; cls: string }[]
  >([]);

  useEffect(() => {
    if (!fire) return;
    const batch = Array.from({ length: 26 }, (_, i) => ({
      id: fire * 100 + i,
      left: 10 + Math.random() * 80,
      dx: (Math.random() - 0.5) * 220,
      dy: 120 + Math.random() * 220,
      rot: (Math.random() - 0.5) * 900,
      delay: Math.random() * 0.18,
      cls: palette[i % palette.length] as string,
    }));
    setPieces(batch);
    const t = setTimeout(() => setPieces([]), 1500);
    return () => clearTimeout(t);
  }, [fire]);

  if (!pieces.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`absolute top-4 h-2.5 w-2 rounded-full animate-confetti ${p.cls}`}
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
