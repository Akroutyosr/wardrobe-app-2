import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { byId } from "@/lib/closet-data";
import { quizPairs, identities } from "@/lib/twinish-data";
import { Confetti } from "@/components/Confetti";
import { WashiTape, Barcode, DashRule } from "@/components/scrapbook";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "Style Quiz · Threadit" },
      {
        name: "description",
        content:
          "Seven this-or-that swipes and Threadit names your style identity — a keepsake card you can come back to any time.",
      },
      { property: "og:title", content: "Style Quiz · Threadit" },
      { property: "og:description", content: "This or that? Find your Threadit style identity." },
    ],
  }),
  component: Quiz,
});

function Quiz() {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [fire, setFire] = useState(0);

  const pair = quizPairs[step];

  const choose = (trait: string) => {
    const next = { ...scores, [trait]: (scores[trait] ?? 0) + 1 };
    setScores(next);
    if (step === quizPairs.length - 1) setFire((f) => f + 1);
    setStep((s) => s + 1);
  };

  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "easy";
  const identity = identities[winner]!;

  return (
    <div className="relative animate-float-in">
      <Confetti fire={fire} />
      <header className="mb-5 text-center">
        <h1 className="display text-4xl">This or that?</h1>
        <p className="mt-1 font-mono text-[0.66rem] uppercase tracking-[0.25em] text-muted-foreground">
          {pair ? `question ${step + 1} of ${quizPairs.length}` : "your style identity"}
        </p>
      </header>

      {pair ? (
        <section key={pair.id} className="paper animate-print relative rounded-3xl p-4">
          <WashiTape className="-left-6 top-4 w-28 -rotate-[18deg]" />
          <p className="display mt-2 text-center text-2xl">{pair.prompt}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[pair.left, pair.right].map((side, i) => {
              const item = byId(side.itemId)!;
              return (
                <button
                  key={side.itemId + i}
                  onClick={() => choose(side.trait)}
                  className="tappable polaroid p-2 text-left"
                  style={{ transform: `rotate(${i ? 2 : -2}deg)` }}
                >
                  <img
                    src={item.image}
                    alt={side.label}
                    className="aspect-[3/4] w-full rounded-xl object-cover"
                  />
                  <p className="handwritten px-1 pt-1.5 text-xl leading-none">{side.label}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(step / quizPairs.length) * 100}%` }}
            />
          </div>
        </section>
      ) : (
        <section className="receipt animate-print px-6 py-7 text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.3em]">style identity card</p>
          <p className="mt-3 text-5xl">{identity.emoji}</p>
          <p className="display mt-1 text-3xl">{identity.name}</p>
          <p className="mt-1 text-[0.72rem] uppercase tracking-widest opacity-70">
            {identity.tagline}
          </p>
          <DashRule />
          <p className="text-[0.78rem] leading-relaxed">{identity.blurb}</p>
          <DashRule />
          <div className="space-y-1 text-left text-[0.72rem]">
            {Object.entries(scores).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="uppercase">{k}</span>
                <span>{"■".repeat(v)}</span>
              </div>
            ))}
          </div>
          <Barcode className="mt-5" />
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                setStep(0);
                setScores({});
              }}
              className="tappable flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground"
            >
              <RotateCcw size={14} /> Retake
            </button>
            <Link
              to="/"
              className="tappable flex flex-1 items-center justify-center rounded-2xl border-2 border-foreground/20 py-3 text-xs font-bold uppercase tracking-widest"
            >
              Today's pick
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
