import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import html2canvas from "html2canvas";
import type { PersonalityResult, WardrobeDNA } from "@/lib/api";
import { StyleMeter } from "@/components/StyleMeter";

/**
 * The quiz result screen (Phase D): the shareable personality card and the
 * gap-based shopping recommendations, side by side at md+, stacked on mobile.
 * Phase E: the card exports itself to a PNG entirely client-side.
 */

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-[#F2619C] text-white",
  medium: "bg-[#FFF183] text-gray-700",
  low: "bg-gray-100 text-gray-500",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "Need it",
  medium: "Would help",
  low: "Nice to have",
};

export function QuizResult({
  result,
  dna,
  onRetake,
}: {
  result: PersonalityResult;
  dna: WardrobeDNA | null;
  onRetake?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const saveCardAsImage = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 2 });
    const link = document.createElement("a");
    link.download = "my-style-personality.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="md:flex md:flex-row md:items-start md:gap-8">
      {/* Panel 1 — shareable personality card */}
      <div
        ref={cardRef}
        className="relative w-full overflow-hidden rounded-3xl p-6 md:w-1/2 md:min-w-0 md:flex-1"
        style={{
          background:
            "repeating-linear-gradient(90deg, #FFF9F0 0px, #FFF9F0 20px, #FFF3E0 20px, #FFF3E0 22px)",
        }}
      >
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[#F2619C]">
          Your Style Personality
        </p>
        <h2 className="display mb-1 text-3xl font-bold text-gray-900">{result.personality_name}</h2>
        <p className="mb-4 font-medium italic text-[#F2619C]">{result.personality_tagline}</p>
        <p className="mb-6 text-sm leading-relaxed text-gray-600">
          {result.personality_description}
        </p>
        <StyleMeter {...result.axis_scores} />
        <div className="mt-6 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500">Wardrobe strengths:</span>
          {result.wardrobe_strengths.map((s) => (
            <span key={s} className="rounded-full bg-[#FAA4B5]/20 px-2 py-1 text-xs text-[#F2619C]">
              {s}
            </span>
          ))}
        </div>
        {result.wardrobe_gaps.length > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            Biggest holes: {result.wardrobe_gaps.join(" · ")}
          </p>
        )}
        <button
          onClick={saveCardAsImage}
          className="tappable mt-4 w-full rounded-xl border border-[#FAA4B5] py-2 text-sm font-medium text-[#F2619C]"
        >
          Save as image
        </button>
      </div>

      {/* Panel 2 — shopping gap recommendations */}
      <div className="mt-5 space-y-4 md:mt-0 md:min-w-0 md:flex-1">
        <div>
          <h3 className="display text-2xl text-gray-900">What your closet is missing</h3>
          <p className="mt-1 text-sm text-gray-500">
            Based on your actual wardrobe of {dna?.total_items ?? "your"} items
            {dna ? ` — ${dna.missing_categories.join(", ") || "that dress-shaped hole"}` : ""}
          </p>
        </div>
        {result.shopping_recommendations.map((rec, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{rec.item_type}</p>
                <p className="mt-1 text-sm text-gray-500">{rec.reason}</p>
                {rec.suggested_color && (
                  <p className="mt-2 text-xs text-[#F2619C]">Try: {rec.suggested_color}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                  PRIORITY_STYLE[rec.priority] ?? PRIORITY_STYLE["low"]
                }`}
              >
                {PRIORITY_LABEL[rec.priority] ?? "Nice to have"}
              </span>
            </div>
            <button
              className="tappable mt-3 text-sm font-medium text-[#F2619C]"
              onClick={() => navigate({ to: "/should-i-buy", search: { hint: rec.item_type } })}
            >
              Check something similar →
            </button>
          </div>
        ))}
        {onRetake && (
          <button
            onClick={onRetake}
            className="tappable w-full rounded-2xl border border-gray-200 bg-card py-3 text-sm font-bold text-gray-500"
          >
            Retake the quiz
          </button>
        )}
      </div>
    </div>
  );
}
