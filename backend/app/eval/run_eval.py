"""
Run the tagging pipeline against your hand-labeled ground truth set and
report per-field accuracy. Re-run this every time you change the tagging
prompt or schema -- it's the only way to know if a change actually helped.

Usage:
    python -m app.eval.run_eval data/eval_set/ground_truth.json

(Copy data/eval_set/ground_truth_template.json to ground_truth.json and fill
it in with 50-100 of your own real items before this is meaningful.)
"""

import json
import sys
from pathlib import Path

from app.tagging.tagger import tag_photo

EXACT_MATCH_FIELDS = ["category", "pattern"]
FUZZY_TEXT_FIELDS = ["subcategory", "fabric_guess", "primary_color", "secondary_color"]
FORMALITY_TOLERANCE = 1  # count as correct if within +/-1


SHADE_MODIFIERS = {"dark", "light", "medium", "pale", "deep", "bright", "off"}


def normalize_color(value: str) -> str:
    words = str(value).strip().lower().replace("-", " ").split()
    return " ".join(w for w in words if w not in SHADE_MODIFIERS) or str(value).strip().lower()


def fuzzy_match(predicted: str, expected: str) -> bool:
    """True if either string contains the other, or they share a word.
    Loose on purpose -- these are free-text fields where 'wool' and
    'wool blend' or 'top' and 'blouse' shouldn't be scored as total misses."""
    p = str(predicted).strip().lower()
    e = str(expected).strip().lower()
    if p == e:
        return True
    if p in e or e in p:
        return True
    p_words = set(p.replace("-", " ").split())
    e_words = set(e.replace("-", " ").split())
    return bool(p_words & e_words)


def season_overlap(predicted: list, expected: list) -> float:
    """Jaccard overlap ratio instead of strict set equality -- partial
    credit for a mostly-right seasons list."""
    pred_set, exp_set = set(predicted), set(expected)
    if not pred_set and not exp_set:
        return 1.0
    union = pred_set | exp_set
    if not union:
        return 1.0
    return len(pred_set & exp_set) / len(union)


def score_item(predicted: dict, expected: dict) -> dict:
    scores = {}
    diffs = {}

    for field in EXACT_MATCH_FIELDS:
        pred_val = str(predicted.get(field)).strip().lower()
        exp_val = str(expected.get(field)).strip().lower()
        correct = pred_val == exp_val
        scores[field] = correct
        if not correct:
            diffs[field] = (predicted.get(field), expected.get(field))

    for field in FUZZY_TEXT_FIELDS:
        pred_val = predicted.get(field, "")
        exp_val = expected.get(field, "")
        if field in ("primary_color", "secondary_color"):
            pred_val = normalize_color(pred_val)
            exp_val = normalize_color(exp_val)
        correct = fuzzy_match(pred_val, exp_val)
        scores[field] = correct
        if not correct:
            diffs[field] = (predicted.get(field), expected.get(field))

    formality_correct = abs(predicted.get("formality", 0) - expected.get("formality", 0)) <= FORMALITY_TOLERANCE
    scores["formality"] = formality_correct
    if not formality_correct:
        diffs["formality"] = (predicted.get("formality"), expected.get("formality"))

    overlap = season_overlap(predicted.get("seasons", []), expected.get("seasons", []))
    scores["seasons"] = overlap >= 0.5  # at least half overlap counts as correct
    if overlap < 1.0:
        diffs["seasons"] = (predicted.get("seasons"), expected.get("seasons"), f"overlap={overlap:.2f}")

    return scores, diffs


def main():
    if len(sys.argv) != 2:
        print("Usage: python -m app.eval.run_eval <path_to_ground_truth.json>")
        sys.exit(1)

    ground_truth_path = Path(sys.argv[1])
    ground_truth = json.loads(ground_truth_path.read_text(encoding="utf-8"))

    if not ground_truth:
        print("Ground truth file is empty. Add labeled items first.")
        return

    all_fields = EXACT_MATCH_FIELDS + FUZZY_TEXT_FIELDS + ["formality", "seasons"]
    field_totals = {f: 0 for f in all_fields}
    field_correct = {f: 0 for f in all_fields}
    failures = []

    for entry in ground_truth:
        image_path = entry["image_path"]
        expected = entry["expected"]

        try:
            predicted = tag_photo(image_path).model_dump()
        except RuntimeError as e:
            failures.append((image_path, str(e)))
            continue

        scores, diffs = score_item(predicted, expected)
        for field, correct in scores.items():
            field_totals[field] += 1
            if correct:
                field_correct[field] += 1

        if diffs:
            print(f"\nMISS on {image_path}:")
            for field, values in diffs.items():
                print(f"    {field}: predicted={values[0]!r}  expected={values[1]!r}" +
                      (f"  ({values[2]})" if len(values) > 2 else ""))

    print("\n--- Per-field accuracy ---")
    for field in field_totals:
        total = field_totals[field]
        correct = field_correct[field]
        pct = (correct / total * 100) if total else 0
        print(f"  {field:16s}: {correct}/{total} ({pct:.0f}%)")

    if failures:
        print(f"\n{len(failures)} item(s) failed to tag at all:")
        for path, err in failures:
            print(f"  {path}: {err}")


if __name__ == "__main__":
    main()
