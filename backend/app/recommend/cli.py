"""
Test the RAG outfit engine end to end.

Usage:
    python -m app.recommend.cli --occasion casual --season summer
    python -m app.recommend.cli --anchor <item_id>
"""

import argparse

from app.recommend.context import OutfitContext
from app.recommend.generate import generate_outfits
from app.recommend.retrieve import retrieve_candidates
from app.storage.db import get_item


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--occasion", default=None)
    parser.add_argument("--season", default=None)
    parser.add_argument("--min-formality", type=int, default=None)
    parser.add_argument("--max-formality", type=int, default=None)
    parser.add_argument("--anchor", default=None, help="item id to build around")
    parser.add_argument("--notes", default="")
    args = parser.parse_args()

    context = OutfitContext(
        occasion=args.occasion,
        season=args.season,
        min_formality=args.min_formality,
        max_formality=args.max_formality,
        anchor_item_id=args.anchor,
        notes=args.notes,
    )

    if args.anchor:
        anchor = get_item(args.anchor)
        if not anchor:
            print(f"No item found with id {args.anchor}")
            return
        print(f"Anchoring on: {anchor['category']}/{anchor['subcategory']} ({anchor['primary_color']})\n")

    shortlist = retrieve_candidates(context)
    print(f"Retrieved {len(shortlist)} candidate items.\n")

    outfits = generate_outfits(shortlist, context)
    for i, outfit in enumerate(outfits, 1):
        print(f"Outfit {i}:")
        for item_id in outfit["item_ids"]:
            item = get_item(item_id)
            print(f"  - [{item_id}] {item['category']}/{item['subcategory']} ({item['primary_color']})")
        print(f"  Reasoning: {outfit['reasoning']}\n")


if __name__ == "__main__":
    main()
