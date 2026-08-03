import type { ReactNode } from "react";

/** A strip of washi tape — drop it on the corner of any card. */
export function WashiTape({ className = "", label }: { className?: string; label?: string }) {
  return (
    <span
      className={`washi pointer-events-none absolute z-20 flex h-7 items-center justify-center px-4 text-[0.7rem] font-bold tracking-wide text-ink/80 ${className}`}
    >
      {label}
    </span>
  );
}

const calloutTones = ["bg-blossom", "bg-fawn", "bg-maize", "bg-sky", "bg-olivine"] as const;

/** Numbered circular callout badge — the recurring "tap for detail" pattern. */
export function Callout({
  n,
  onClick,
  active,
  className = "",
  style,
}: {
  n: number;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Detail ${n}`}
      style={style}
      className={`tappable z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-sm font-extrabold shadow-polaroid ${
        active
          ? "bg-rose text-primary-foreground"
          : `${calloutTones[(n - 1) % calloutTones.length]} text-ink`
      } ${className}`}
    >
      {n}
    </button>
  );
}

/** Hand-drawn arrow + handwritten annotation. */
export function ArrowNote({
  children,
  flip = false,
  className = "",
}: {
  children: ReactNode;
  flip?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-1.5 ${flip ? "flex-row-reverse text-right" : ""} ${className}`}
    >
      <svg
        width="42"
        height="26"
        viewBox="0 0 42 26"
        fill="none"
        aria-hidden
        className={`mt-1 shrink-0 text-primary ${flip ? "-scale-x-100" : ""}`}
      >
        <path
          d="M2 22C10 22 22 19 31 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="0.1 5"
        />
        <path
          d="M24 5.5 33 4l-1.5 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="handwritten max-w-[13rem] text-[1.05rem] leading-tight text-foreground/80">
        {children}
      </p>
    </div>
  );
}

/** Sticker-style pill used for filters and tags. */
export function Sticker({
  children,
  selected,
  onClick,
  tone = "primary",
  tilt = 0,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  tone?: "primary" | "lilac" | "mint" | "butter";
  tilt?: number;
}) {
  const tones = {
    primary: "bg-rose text-primary-foreground",
    lilac: "bg-blossom text-ink",
    mint: "bg-olivine text-ink",
    butter: "bg-maize text-ink",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ transform: `rotate(${tilt}deg)` }}
      className={`tappable shrink-0 rounded-full px-4 py-2 text-xs font-extrabold capitalize tracking-wide ${
        selected ? `${tones[tone]} shadow-polaroid` : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** Big rubber-stamp verdict. */
export function Stamp({
  verdict,
  className = "",
}: {
  verdict: "APPROVED" | "SKIP" | "MAYBE";
  className?: string;
}) {
  const tone =
    verdict === "APPROVED"
      ? "text-rose border-rose"
      : verdict === "SKIP"
        ? "text-fawn border-fawn"
        : "text-stamp-maybe border-stamp-maybe";
  return (
    <div
      className={`animate-stamp inline-block -rotate-[9deg] rounded-xl border-[5px] px-6 py-2 opacity-95 ${tone} ${className}`}
      style={{ boxShadow: "inset 0 0 0 2px currentColor" }}
    >
      <span className="text-4xl font-extrabold tracking-[0.18em]">{verdict}</span>
    </div>
  );
}

export function Barcode({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-1 ${className}`} aria-hidden>
      <div className="barcode h-12 w-full text-foreground/85" />
      <p className="text-center font-mono text-[0.65rem] tracking-[0.35em]">7 291046 000841</p>
    </div>
  );
}

export function DashRule() {
  return <div className="my-3 border-t-2 border-dashed border-foreground/20" aria-hidden />;
}
