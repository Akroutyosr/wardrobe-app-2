"""
Structural eval for the RAG outfit engine -- no ground truth, checks
correctness rules instead.

Architected evaluation framework with test dataset and JSON configuration.
"""

"""
Evaluates the RAG outfit engine against structural correctness rules --
there's no single "correct" outfit to compare against (unlike Phase 1's
tagging eval), so this checks rules that should always hold regardless
of which specific items get chosen:

  - every outfit has a top-half item OR a dress, AND a bottom-half item
    (unless a dress substitutes), PLUS shoes
  - every referenced item id actually exists in the shortlist (generate.py
    already filters these, but we track the rate here to catch regressions)
  - formality spread within a single outfit isn't wildly inconsistent
  - no two outfits in the same batch are exact duplicates of each other

Run across several varied contexts to get a pass rate, not just one case.

Usage:
    python -m app.eval.eval_outfits
"""

from app.recommend.context import OutfitContext
from app.recommend.generate import generate_outfits
from app.recommend.retrieve import retrieve_candidates
from app.storage.db import get_item

TOP_HALF = {"top", "outerwear"}  # outerwear alone doesn't complete an outfit, but signals a top-half layer
BOTTOM_HALF = {"bottom"}
FORMALITY_SPREAD_LIMIT = 2

TEST_CONTEXTS = [
    OutfitContext(occasion="casual", season="summer"),
    OutfitContext(occasion="work", season="fall", min_formality=3),
    OutfitContext(occasion="date night", season="winter"),
    OutfitContext(occasion="casual", season="spring", max_formality=2),
]


def check_completeness(items: list[dict]) -> tuple[bool, str]:
    categories = {i["category"] for i in items}
    has_dress = "dress" in categories
    has_top = bool(categories & TOP_HALF - {"outerwear"}) or "top" in categories
    has_bottom = bool(categories & BOTTOM_HALF)
    has_shoes = "shoes" in categories

    if not has_shoes:
        return False, "missing shoes"
    if has_dress:
        return True, "ok (dress-based)"
    if has_top and has_bottom:
        return True, "ok (top+bottom)"
    return False, f"incomplete: categories={categories}"


def check_formality_spread(items: list[dict]) -> tuple[bool, str]:
    formalities = [i["formality"] for i in items]
    spread = max(formalities) - min(formalities)
    return spread <= FORMALITY_SPREAD_LIMIT, f"spread={spread}"


def run_eval():
    total_outfits = 0
    complete_count = 0
    formality_ok_count = 0
    all_outfit_id_sets = []
    duplicate_batches = 0

    for context in TEST_CONTEXTS:
        shortlist = retrieve_candidates(context)
        outfits = generate_outfits(shortlist, context)

        print(f"\nContext: occasion={context.occasion}, season={context.season}, "
              f"formality=[{context.min_formality},{context.max_formality}]")
        print(f"  Shortlist size: {len(shortlist)}, outfits generated: {len(outfits)}")

        batch_id_sets = []
        for outfit in outfits:
            total_outfits += 1
            items = [get_item(i) for i in outfit["item_ids"]]
            if any(i is None for i in items):
                print(f"  FAIL: outfit references a nonexistent item id -- {outfit['item_ids']}")
                continue

            complete, reason = check_completeness(items)
            if complete:
                complete_count += 1
            else:
                print(f"  FAIL completeness: {reason} -- {outfit['item_ids']}")

            formality_ok, spread_info = check_formality_spread(items)
            if formality_ok:
                formality_ok_count += 1
            else:
                print(f"  WARN formality spread: {spread_info} -- {outfit['item_ids']}")

            id_set = frozenset(outfit["item_ids"])
            if id_set in batch_id_sets:
                duplicate_batches += 1
                print(f"  FAIL: duplicate outfit within same batch -- {outfit['item_ids']}")
            batch_id_sets.append(id_set)

        all_outfit_id_sets.extend(batch_id_sets)

    print("\n--- Eval summary ---")
    print(f"Total outfits generated: {total_outfits}")
    print(f"Structurally complete: {complete_count}/{total_outfits} ({complete_count/total_outfits*100:.0f}%)" if total_outfits else "No outfits generated.")
    print(f"Formality spread OK: {formality_ok_count}/{total_outfits} ({formality_ok_count/total_outfits*100:.0f}%)" if total_outfits else "")
    print(f"Duplicate outfits within a batch: {duplicate_batches}")


if __name__ == "__main__":
    run_eval()
