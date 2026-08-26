type Props = {
  /** Stroke color classes for the tracing thread (e.g. "text-rose"). */
  className?: string;
  /** Corner radius in px. */
  rx?: number;
  /** ms before the thread starts sewing. */
  delay?: number;
};

/**
 * A seam that sews itself around a card: a faint dotted stitch guide is always
 * there, and on mount a solid thread traces the full perimeter once. Drop it
 * inside any `relative` container as the last child. Percentage geometry keeps
 * it responsive; pathLength=100 normalizes the dash math to any perimeter.
 */
export function StitchFrame({ className = "text-rose", rx = 24, delay = 120 }: Props) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-10 h-full w-full ${className}`}
    >
      <rect
        x="1.5%"
        y="1.5%"
        width="97%"
        height="97%"
        rx={rx}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray="3 4"
        opacity={0.35}
        pathLength={100}
      />
      <rect
        x="1.5%"
        y="1.5%"
        width="97%"
        height="97%"
        rx={rx + 1}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeDasharray="100"
        pathLength={100}
        className="animate-sew"
        style={{ animationDelay: `${delay}ms` }}
      />
    </svg>
  );
}
