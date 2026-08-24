import { Link } from "@tanstack/react-router";
import type { Challenge } from "@/lib/api";

const TYPE_EMOJI: Record<string, string> = {
  wear_neglected: "👗",
  style_item_N_ways: "✨",
  no_repeat_week: "🗓️",
  rating_streak: "🔥",
};

type Props = {
  challenge: Challenge;
};

export function ChallengeCard({ challenge }: Props) {
  const progress = Math.min(challenge.current_count / challenge.target_count, 1);
  const isComplete = challenge.status === "completed";
  const daysLeft = Math.ceil(
    (new Date(challenge.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div
      className={`rounded-2xl border bg-card p-3.5 shadow-polaroid transition-all ${
        isComplete ? "border-olivine/50 bg-olivine/10" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{TYPE_EMOJI[challenge.type] ?? "⭐"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-extrabold">{challenge.title}</p>
            <span
              className={`shrink-0 font-mono text-xs font-bold ${
                isComplete ? "text-olivine" : "text-rose"
              }`}
            >
              {isComplete ? "✓ done" : `${challenge.current_count}/${challenge.target_count}`}
            </span>
          </div>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-muted-foreground">
            {challenge.description}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isComplete ? "bg-olivine" : "bg-rose"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        {!isComplete && (
          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            {daysLeft > 1 ? `${daysLeft}d left` : daysLeft === 1 ? "last day" : "expires today"}
          </p>
        )}
        {isComplete && (
          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-widest text-olivine">
            completed {challenge.completed_at}
          </p>
        )}
        {challenge.target_item_id && !isComplete && (
          <Link
            to="/closet/$itemId"
            params={{ itemId: challenge.target_item_id }}
            className="ml-auto text-xs font-bold text-rose"
          >
            See item →
          </Link>
        )}
      </div>
    </div>
  );
}
