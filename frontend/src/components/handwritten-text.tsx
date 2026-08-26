import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  as?: "p" | "span" | "h2" | "h3";
};

/**
 * Handwritten text that reveals itself left-to-right like ink appearing
 * on paper. Combines the Caveat "handwritten" font with a clip-path
 * sweep animation. Respects reduced-motion globally.
 */
export function HandwrittenText({ children, className = "", as: Tag = "p" }: Props) {
  return <Tag className={`handwritten animate-ink inline-block ${className}`}>{children}</Tag>;
}
