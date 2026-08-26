/**
 * A seam that sews itself around a card — the hand-stitched scrapbook detail.
 *
 * - SVG turbulence filter gives the line organic wobble (no two renders identical)
 * - Bold running-stitch guide + animated solid tracer
 * - Cross-stitches at each corner (the human tell)
 * - Dangling thread tail at the starting point
 * - Needle-hole dots punched along the guide
 *
 * Drop inside any `relative` container as the last child.
 */
export function StitchFrame({
  className = "text-rose",
  rx = 24,
  delay = 120,
}: {
  className?: string;
  rx?: number;
  delay?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-10 h-full w-full ${className}`}
    >
      <defs>
        <filter id="stitch-roughen" x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.04"
            numOctaves="4"
            seed="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      <g filter="url(#stitch-roughen)">
        {/* guide — bold dashed running stitch, always visible */}
        <rect
          x="3%"
          y="3%"
          width="94%"
          height="94%"
          rx={rx}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeDasharray="6 5"
          opacity={0.4}
          pathLength={100}
        />

        {/* needle-hole dots along the guide */}
        {(
          [
            [50, 3],
            [97, 50],
            [50, 97],
            [3, 50],
            [25, 3],
            [75, 3],
            [97, 25],
            [97, 75],
            [75, 97],
            [25, 97],
            [3, 75],
            [3, 25],
          ] as [number, number][]
        ).map(([cx, cy], i) => (
          <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r={1.5} fill="currentColor" opacity={0.25} />
        ))}

        {/* cross-stitches at each corner — the human tell */}
        {(
          [
            [4.5, 4.5],
            [95.5, 4.5],
            [95.5, 95.5],
            [4.5, 95.5],
          ] as [number, number][]
        ).map(([cx, cy], i) => (
          <g key={`x-${i}`} opacity={0.55}>
            <line
              x1={`${cx - 1.2}%`}
              y1={`${cy - 1.2}%`}
              x2={`${cx + 1.2}%`}
              y2={`${cy + 1.2}%`}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <line
              x1={`${cx + 1.2}%`}
              y1={`${cy - 1.2}%`}
              x2={`${cx - 1.2}%`}
              y2={`${cy + 1.2}%`}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* animated tracer — solid thread sewing the perimeter */}
        <rect
          x="3%"
          y="3%"
          width="94%"
          height="94%"
          rx={rx}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="100"
          pathLength={100}
          className="animate-sew"
          style={{ animationDelay: `${delay}ms` }}
        />

        {/* thread tail — dangling from the starting stitch */}
        <line
          x1="3%"
          y1="4.5%"
          x2="1%"
          y2="7%"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.5}
        />
        <circle cx="1%" cy="7%" r={1.5} fill="currentColor" opacity={0.5} />
      </g>
    </svg>
  );
}
