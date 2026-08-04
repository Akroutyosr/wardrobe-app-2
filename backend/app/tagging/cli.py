"""
Add a wardrobe item: tag it automatically, let you correct any field, save it.

Usage:
    python -m app.tagging.cli data/photos/blue_shirt.jpg
"""

import sys

from app.storage.ingest import ingest_item
from app.tagging.schema import ClothingItem
from app.tagging.tagger import tag_photo


def _prompt_correction(field: str, current_value) -> str:
    raw = input(f"  {field} [{current_value}] (press Enter to keep, or type new value): ").strip()
    return raw if raw else current_value


def review_and_correct(item: ClothingItem) -> dict:
    """Show each tagged field and let the user override it before saving."""
    data = item.model_dump()
    print("\nAuto-tagged as:")
    for field, value in data.items():
        print(f"  {field}: {value}")

    if input("\nAccept all as-is? [Y/n]: ").strip().lower() == "n":
        for field in data:
            new_value = _prompt_correction(field, data[field])
            # seasons is a list -- accept comma-separated input if corrected
            if field == "seasons" and isinstance(new_value, str):
                new_value = [s.strip() for s in new_value.split(",") if s.strip()]
            # formality must stay an int
            if field == "formality" and isinstance(new_value, str):
                new_value = int(new_value)
            data[field] = new_value

    return data


def main():
    if len(sys.argv) != 2:
        print("Usage: python -m app.tagging.cli <path_to_photo>")
        sys.exit(1)

    image_path = sys.argv[1]
    print(f"Tagging {image_path} ...")
    item = tag_photo(image_path)

    corrected = review_and_correct(item)
    saved = ingest_item(image_path, corrected)
    print(f"\nSaved item {saved['id']} to Postgres (items.embedding for similarity)")


if __name__ == "__main__":
    main()
