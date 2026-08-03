"""
Evaluates the shopping agent against a small hand-labeled set of test
cases where the correct verdict DIRECTION is defensible (a near-duplicate
should skip; a genuine gap-filler shouldn't). Smaller set than Phase 1's
tagging eval since each case needs real judgment to construct, not just
a quick label.

Checks two things per case:
  1. Does the verdict's direction (buy/maybe vs. skip) match expectations?
  2. Did the agent actually call the tools it needs to ground that verdict
     (tag_new_item, check_duplicates, compute_versatility_score), rather
     than answering from guesswork?

Usage:
    python -m app.eval.eval_agent data/eval_set/agent_eval_set.json
"""

import json
import sys
from pathlib import Path

from app.agent.orchestrator import evaluate_purchase

REQUIRED_TOOLS = {"tag_new_item", "check_duplicates", "compute_versatility_score"}


def classify_verdict(verdict_text: str) -> str:
    """Rough direction classifier based on the verdict's opening words."""
    lowered = verdict_text.strip().lower()
    if lowered.startswith("verdict: skip") or "recommend skipping" in lowered[:120]:
        return "skip"
    if lowered.startswith("verdict: buy") or lowered.startswith("verdict: maybe"):
        return "buy_or_maybe"
    # fallback: look for the words anywhere in the first line
    first_line = lowered.split("\n")[0]
    if "skip" in first_line:
        return "skip"
    if "buy" in first_line or "maybe" in first_line:
        return "buy_or_maybe"
    return "unclear"


def main():
    if len(sys.argv) != 2:
        print("Usage: python -m app.eval.eval_agent <path_to_agent_eval_set.json>")
        sys.exit(1)

    eval_set_path = Path(sys.argv[1])
    test_cases = json.loads(eval_set_path.read_text(encoding="utf-8"))

    if not test_cases:
        print("Eval set is empty. Add labeled test cases first.")
        return

    direction_correct = 0
    tool_coverage_correct = 0

    for case in test_cases:
        image_path = case["image_path"]
        expected = case["expected_direction"]

        print(f"\n--- {image_path} (expected: {expected}) ---")
        verdict_text, tool_log = evaluate_purchase(image_path, verbose=False)

        predicted = classify_verdict(verdict_text)
        direction_ok = predicted == expected
        if direction_ok:
            direction_correct += 1
        print(f"  Direction: predicted={predicted}, expected={expected} -- {'OK' if direction_ok else 'MISMATCH'}")

        called_tools = {entry["name"] for entry in tool_log}
        missing = REQUIRED_TOOLS - called_tools
        tool_ok = not missing
        if tool_ok:
            tool_coverage_correct += 1
        else:
            print(f"  Tool coverage: MISSING {missing}")
        print(f"  Verdict snippet: {verdict_text[:150]}...")

    total = len(test_cases)
    print("\n--- Eval summary ---")
    print(f"Verdict direction correct: {direction_correct}/{total} ({direction_correct/total*100:.0f}%)")
    print(f"Required tool coverage: {tool_coverage_correct}/{total} ({tool_coverage_correct/total*100:.0f}%)")


if __name__ == "__main__":
    main()
