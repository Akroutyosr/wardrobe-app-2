import type { ClosetItem } from "@/lib/closet-data";

/**
 * The "What I'm Serving Today" plate: an outfit scattered across a plate,
 * cutlery on either side, warm paper-stripe surface behind it.
 *
 * Layout is deterministic -- each item's position, size and rotation are
 * seeded from its item id (plus the outfit's seed), so the same look always
 * renders identically instead of jittering between visits.
 */

/** FNV-1a style string hash -> unsigned int. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0..1 value for a given seed key. */
function seeded(key: string, k: number): number {
  return (hashSeed(`${key}:${k}`) % 1000) / 1000;
}

/** Deterministic per-item tilt, clamped to the ±3–8° scatter range. */
function rotation(id: string): number {
  return Math.max(-8, Math.min(8, (hashSeed(`rot:${id}`) % 130) / 10 - 6.5));
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function ForkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3v5a6 6 0 0 0 12 0V3" />
      <path d="M9.5 3v6" />
      <path d="M14.5 3v6" />
      <path d="M12 9v12" />
    </svg>
  );
}

function SpoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 5.5a7 7 0 0 0 14 0" />
      <path d="M12 10.5V21" />
    </svg>
  );
}

type PlateCardProps = {
  label?: string;
  items: ClosetItem[];
};

export function PlateCard({ label, items }: PlateCardProps) {
  const n = items.length;
  const seed = items[0]?.id ?? "empty-plate";
  const widthPct = n <= 3 ? 44 : n === 4 ? 40 : n === 5 ? 34 : 30;

  const placed = items.map((item, i) => {
    // Sunflower-style scatter: even angular spread plus a per-outfit jitter,
    // items drifting from the centre outward so they stay inside the plate.
    const angle = i * GOLDEN_ANGLE + seeded(seed, 1) * 0.8;
    const radius = (0.17 + 0.27 * ((i + 0.5) / Math.max(n, 1))) * (0.9 + 0.2 * seeded(item.id, 2));
    return {
      item,
      left: 50 + Math.cos(angle) * radius * 50,
      top: 50 + Math.sin(angle) * radius * 50,
      rot: rotation(item.id),
      cutout: Boolean(item.cutout),
      z: i + 2,
    };
  });

  return (
    <div className="plate-card">
      <p className="plate-headline">What I&apos;m Serving Today</p>
      {label ? <p className="plate-label">{label}</p> : null}

      <div className="plate-stage">
        <ForkIcon className="plate-fork" />
        <div className="plate">
          {placed.map((p) => (
            <img
              key={p.item.id}
              src={p.item.cutout ?? p.item.image}
              alt={p.item.name}
              loading="lazy"
              className={p.cutout ? "plate-item" : "plate-item plate-item-photo"}
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${widthPct}%`,
                zIndex: p.z,
                transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
              }}
            />
          ))}
        </div>
        <SpoonIcon className="plate-spoon" />
      </div>
    </div>
  );
}
