"""
Single entry point: takes tagged item data, writes it to both the Postgres
wardrobe (structured fields) and the vector index, and generates the item's
transparent cutout (cached to disk, best-effort).
"""

from app.storage.db import add_item, generate_cutout, set_item_cutout
from app.storage.vectors import add_embedding


def ingest_item(image_path: str, tags: dict) -> dict:
    saved = add_item(image_path, tags)
    add_embedding(saved["id"], tags)
    try:
        cutout_path = generate_cutout(image_path)
        set_item_cutout(saved["id"], cutout_path)
        saved["cutout_path"] = cutout_path
    except Exception:
        # Cutout generation is best-effort -- the wardrobe still works without it.
        saved["cutout_path"] = None
    return saved
