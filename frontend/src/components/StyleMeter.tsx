import type { AxisSignals, QuizOption } from "@/lib/quiz-questions";

/**
 * Live 3-axis style meter — casually/formal, minimal/maximal, timeless/trendy.
 * Updates after every quiz answer; also rendered on the final personality card.
 */

export type MeterProps = {
  casual_formal: number; // 0-100
  minimal_maximal: number;
  timeless_trendy: number;
};

const Meter = ({
  label,
  left,
  right,
  value,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs text-gray-500">
      <span>{left}</span>
      <span className="sr-only">({label})</span>
      <span>{right}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${value}%`,
          background: "linear-gradient(90deg, #FAA4B5, #F2619C)",
        }}
      />
    </div>
  </div>
);

export function StyleMeter({ casual_formal, minimal_maximal, timeless_trendy }: MeterProps) {
  return (
    <div className="space-y-3 rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Your style is forming...
      </p>
      <Meter label="vibe" left="Casual" right="Formal" value={casual_formal} />
      <Meter label="scale" left="Minimal" right="Maximal" value={minimal_maximal} />
      <Meter label="time" left="Timeless" right="Trendy" value={timeless_trendy} />
    </div>
  );
}

/**
 * Accumulate every answered option's axis signals and normalize to 0-100.
 * Each signal is -2..+2, so `50 + (mean * 25)` spans 0..100; clamped defensively.
 */
export function updateMeters(answers: QuizOption[]): MeterProps {
  const total = { cf: 0, mm: 0, tt: 0 };
  answers.forEach((a) => {
    const s: AxisSignals = a.axis_signals;
    total.cf += s.casual_formal;
    total.mm += s.minimal_maximal;
    total.tt += s.timeless_trendy;
  });
  const normalize = (v: number, n: number) => Math.min(100, Math.max(0, 50 + (v / n) * 25));
  const n = answers.length;
  return {
    casual_formal: normalize(total.cf, n),
    minimal_maximal: normalize(total.mm, n),
    timeless_trendy: normalize(total.tt, n),
  };
}
