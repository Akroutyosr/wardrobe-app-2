"""
Log that an outfit was worn, with a rating, to build the feedback history
that future outfit generations will learn from.

Usage:
    python -m app.recommend.log_feedback --items id1,id2,id3 --rating 5
    python -m app.recommend.log_feedback --items id1,id2 --rating 2 --date 2026-08-01
"""

import argparse

from app.storage.db import get_item, log_outfit_wear


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--items", required=True, help="comma-separated item ids")
    parser.add_argument("--rating", type=int, required=True, choices=range(1, 6))
    parser.add_argument("--date", default=None, help="YYYY-MM-DD, defaults to today")
    args = parser.parse_args()

    item_ids = [i.strip() for i in args.items.split(",")]

    for item_id in item_ids:
        if get_item(item_id) is None:
            print(f"Warning: no item found with id {item_id} -- check for typos.")
            return

    outfit_id = log_outfit_wear(item_ids, args.rating, args.date)
    print(f"Logged outfit {outfit_id} with rating {args.rating}/5.")


if __name__ == "__main__":
    main()
