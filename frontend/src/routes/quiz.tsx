import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { closet as mockCloset } from "@/lib/closet-data";
import type { ClosetItem } from "@/lib/closet-data";
import { buildQuizQuestions, type QuizItemSource, type QuizOption } from "@/lib/quiz-questions";
import { StyleMeter, updateMeters, type MeterProps } from "@/components/StyleMeter";
import { QuizResult } from "@/components/QuizResult";
import {
  analyzeQuiz,
  fetchApiItems,
  fetchQuizResult,
  fetchWardrobeDNA,
  saveQuizResult,
  type PersonalityResult,
  type WardrobeDNA,
} from "@/lib/api";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "Style Quiz · Twinish" },
      {
        name: "description",
        content:
          "Eighteen questions across your real wardrobe, real scenarios and your shopping instincts — Twinish names your style personality and the gaps worth filling.",
      },
      { property: "og:title", content: "Style Quiz · Twinish" },
      { property: "og:description", content: "Find your style personality, grounded in your real closet." },
    ],
  }),
  component: Quiz,
});

type QuizAnswer = {
  question_id: string;
  chosen_option: string;
  formality?: number;
  pattern?: string;
  color_family?: string;
  axis_signals?: Record<string, number>;
};

type View = "intro" | "quiz" | "loading" | "result";

const DEFAULT_METER: MeterProps = { casual_formal: 50, minimal_maximal: 50, timeless_trendy: 50 };

const SECTION_LABEL: Record<number, string> = {
  1: "from your closet",
  2: "real-world scenario",
  3: "shopping instinct",
};

/** Offline fallback: build the deck from the mock closet when the API is down. */
const FORMALITY_MAP: Record<string, number> = {
  "cozy casual": 2,
  casual: 2,
  smart: 4,
  dressy: 5,
  any: 3,
};

function mockToSource(i: ClosetItem): QuizItemSource {
  return {
    id: i.id,
    image: i.image,
    category: i.category,
    primary_color: i.color,
    pattern: "solid",
    formality: FORMALITY_MAP[i.formality] ?? 3,
    seasons: i.season,
  };
}

function isStale(takenAt: string): boolean {
  return Date.now() - Date.parse(takenAt) > 30 * 24 * 60 * 60 * 1000;
}

function Quiz() {
  const [view, setView] = useState<View>("intro");
  const [sourceItems, setSourceItems] = useState<QuizItemSource[]>([]);
  const [deck, setDeck] = useState<ReturnType<typeof buildQuizQuestions>>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [meter, setMeter] = useState<MeterProps>(DEFAULT_METER);
  const [dna, setDna] = useState<WardrobeDNA | null>(null);
  const [result, setResult] = useState<PersonalityResult | null>(null);
  const [oldResult, setOldResult] = useState<(PersonalityResult & { taken_at: string }) | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchApiItems()
      .then((items) => {
        setSourceItems(items);
        setDeck(buildQuizQuestions(items));
      })
      .catch(() => {
        const fallback = mockCloset.map(mockToSource);
        setSourceItems(fallback);
        setDeck(buildQuizQuestions(fallback));
      });
    void fetchWardrobeDNA().then(setDna);
    // Phase F: land on the previous result when it's under 30 days old.
    void fetchQuizResult().then((r) => {
      setOldResult(r);
      if (r && !isStale(r.taken_at)) {
        setResult(r);
        setView("result");
      }
    });
  }, []);

  const question = deck[step];

  const choose = (option: QuizOption) => {
    const next: QuizAnswer[] = [
      ...answers,
      {
        question_id: question!.id,
        chosen_option: option.id,
        formality: option.formality,
        pattern: option.pattern,
        color_family: option.color_family,
        axis_signals: option.axis_signals,
      },
    ];
    setAnswers(next);
    // Rehydrate the full option list answered so far to drive the live meter.
    const answeredOptions = deck.slice(0, next.length).map((q, i) => {
      const id = next[i]!.chosen_option;
      return q.options.find((o) => o.id === id)!;
    });
    setMeter(updateMeters(answeredOptions));
    if (next.length >= deck.length) {
      void submit(next);
    } else {
      setStep((s) => s + 1);
    }
  };

  const submit = async (finalAnswers: QuizAnswer[]) => {
    setView("loading");
    setSubmitError(null);
    try {
      const res = await analyzeQuiz(finalAnswers);
      setResult(res);
      setView("result");
      void saveQuizResult(res).catch(() => {});
    } catch (err) {
      console.error("quiz analyze failed:", err);
      setSubmitError(String(err));
    }
  };

  const start = () => {
    if (sourceItems.length === 0) return;
    setDeck(buildQuizQuestions(sourceItems)); // fresh random pairs each run
    setStep(0);
    setAnswers([]);
    setMeter(DEFAULT_METER);
    setSubmitError(null);
    setResult(null);
    setView("quiz");
  };

  if (view === "result" && result) {
    return (
      <div className="animate-float-in">
        <header className="mb-5">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.25em] text-muted-foreground">
            your style personality
          </p>
          <h1 className="display mt-1 text-4xl">The verdict</h1>
        </header>
        <QuizResult result={result} dna={dna} onRetake={start} />
        <p className="mt-6 text-center font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          the stylist re-reads your closet each time — come back in a month
        </p>
      </div>
    );
  }

  if (view === "loading") {
    return (
      <div className="animate-float-in">
        <section className="rounded-4xl bg-card p-10 text-center shadow-lift">
          <div className="mx-auto flex h-16 w-16 animate-breathe items-center justify-center rounded-full bg-blossom text-2xl">
            🔮
          </div>
          <p className="display mt-5 text-3xl">Consulting the stylist…</p>
          <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            cross-referencing your answers with your real wardrobe DNA
          </p>
          {submitError ? (
            <div className="mt-5">
              <p className="text-sm font-semibold text-rose">{submitError}</p>
              <button
                onClick={() => void submit(answers)}
                className="tappable mt-3 inline-flex items-center gap-2 rounded-full bg-rose px-5 py-2 text-sm font-extrabold text-primary-foreground"
              >
                <RefreshCw size={15} /> Try again
              </button>
            </div>
          ) : (
            <div className="mx-auto mt-5 h-2 w-44 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-rose" />
            </div>
          )}
        </section>
      </div>
    );
  }

  if (view === "quiz" && question) {
    const pairVisual = question.options.every((o) => o.image);
    return (
      <div className="animate-float-in">
        <header className="mb-4">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.25em] text-muted-foreground">
            question {step + 1} of {deck.length} · {SECTION_LABEL[question.section]}
          </p>
          <h1 className="display mt-1 text-3xl">{question.prompt}</h1>
        </header>

        <section className="paper animate-print relative rounded-3xl p-4">
          {pairVisual ? (
            <div className="grid grid-cols-2 gap-3">
              {question.options.map((option, i) => (
                <button
                  key={option.id}
                  onClick={() => choose(option)}
                  className="tappable polaroid p-2 text-left"
                  style={{ transform: `rotate(${i % 2 ? 2 : -2}deg)` }}
                >
                  <img
                    src={option.image}
                    alt=""
                    className="aspect-[3/4] w-full rounded-xl object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {question.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => choose(option)}
                  className="tappable w-full rounded-2xl bg-secondary px-4 py-3.5 text-left text-sm font-bold text-secondary-foreground"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(step / deck.length) * 100}%` }}
            />
          </div>
        </section>

        <div className="mt-4">
          <StyleMeter {...meter} />
        </div>
      </div>
    );
  }

  const stale = oldResult ? isStale(oldResult.taken_at) : false;
  return (
    <div className="relative animate-float-in">
      <header className="mb-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blossom px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-widest text-ink">
          <Sparkles size={12} /> 18 questions
        </span>
        <h1 className="display mt-3 text-4xl">Find your style personality</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Six pairs from your own closet, six real scenarios, six shopping instincts.
        </p>
      </header>

      {oldResult && stale && (
        <section className="mb-4 rounded-3xl bg-maize p-5 text-ink shadow-polaroid">
          <p className="display text-2xl">Retake your quiz</p>
          <p className="mt-1 text-sm font-bold opacity-80">
            Your last read ({oldResult.personality_name}) is over 30 days old — see how your style
            has evolved.
          </p>
        </section>
      )}

      <section className="paper rounded-3xl p-5">
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2">
            <span className="rounded-full bg-blossom px-2 py-0.5 text-[0.6rem] font-extrabold uppercase">
              closet
            </span>
            Photo pairs from pieces you actually own — no labels, pure instinct.
          </p>
          <p className="flex items-center gap-2">
            <span className="rounded-full bg-sky px-2 py-0.5 text-[0.6rem] font-extrabold uppercase">
              scenarios
            </span>
            Last-minute dinner, farmers market, flight day — what do you reach for?
          </p>
          <p className="flex items-center gap-2">
            <span className="rounded-full bg-olivine px-2 py-0.5 text-[0.6rem] font-extrabold uppercase">
              instincts
            </span>
            Your buying brain, interrogated in six meta-questions.
          </p>
        </div>
        <button
          onClick={start}
          disabled={sourceItems.length === 0}
          className="tappable mt-5 flex w-full items-center justify-center gap-2 rounded-3xl bg-rose py-4 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
        >
          {sourceItems.length === 0 ? (
            <>
              <Loader2 className="animate-spin" size={17} /> Reading your closet…
            </>
          ) : stale ? (
            <>Retake my quiz · see the evolution</>
          ) : (
            <>Start the 18-question quiz</>
          )}
        </button>
        <Link
          to="/"
          className="mt-3 flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground underline"
        >
          <ArrowLeft size={13} /> Back to today
        </Link>
      </section>
    </div>
  );
}