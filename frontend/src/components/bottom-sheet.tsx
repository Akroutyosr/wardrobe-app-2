import { useEffect, type ReactNode } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name for the dialog; also rendered as the header title. */
  title: string;
  children: ReactNode;
};

/**
 * THE app-wide bottom sheet. One implementation of the interaction details
 * that are easy to get wrong: scroll lock, Escape-to-close, focusable
 * backdrop, slide-up entrance. QuickLog and the Planner picker both sit on
 * this — new modals should too, instead of hand-rolling overlays.
 */
export function BottomSheet({ isOpen, onClose, title, children }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <button
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 animate-fade-fast cursor-default bg-black/40"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[85vh] w-full animate-sheet-up flex-col overflow-hidden rounded-t-4xl bg-card p-6 shadow-lift"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-xl">{title}</h2>
          <button onClick={onClose} className="text-sm font-bold text-muted-foreground">
            Cancel
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
