import { useState, type CSSProperties, type ReactNode } from "react";
import type { ClosetItem } from "@/lib/closet-data";

export function Chip({
  children,
  selected,
  onClick,
  tone = "primary",
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  tone?: "primary" | "lilac" | "mint" | "butter";
}) {
  const tones = {
    primary: "bg-primary text-primary-foreground",
    lilac: "bg-lilac text-lilac-foreground",
    mint: "bg-mint text-mint-foreground",
    butter: "bg-butter text-butter-foreground",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`tappable shrink-0 rounded-full px-4 py-2 text-sm font-semibold capitalize ${
        selected
          ? tones[tone] + " shadow-polaroid"
          : "bg-card text-muted-foreground border border-border"
      }`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "mint",
}: {
  children: ReactNode;
  tone?: "primary" | "lilac" | "mint" | "butter" | "blush";
}) {
  const tones = {
    primary: "bg-primary text-primary-foreground",
    lilac: "bg-lilac text-lilac-foreground",
    mint: "bg-mint text-mint-foreground",
    butter: "bg-butter text-butter-foreground",
    blush: "bg-blush text-accent-foreground",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold capitalize ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ItemThumb({
  item,
  className = "",
  rotate = 0,
}: {
  item: ClosetItem;
  className?: string;
  rotate?: number;
}) {
  return (
    <div
      className={`polaroid tappable p-1.5 ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <SafeImage
        src={item.image}
        alt={item.name}
        className="h-full w-full rounded-[0.9rem] object-cover"
      />
    </div>
  );
}

/**
 * An <img> that degrades to a tidy basket placeholder when the file is gone
 * (deleted on the server, or a mock entry with no real photo) instead of
 * rendering the browser's broken-image icon.
 */
export function SafeImage({
  src,
  alt,
  className = "",
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <span
        role="img"
        aria-label={alt}
        style={style}
        className={`flex items-center justify-center bg-muted text-2xl ${className}`}
      >
        🧺
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      style={style}
      className={className}
    />
  );
}
