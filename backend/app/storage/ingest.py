"""
Single entry point: takes tagged item data, writes it to both SQLite
(structured fields) and Chroma (embedding for similarity search).
"""

from app.storage.db import add_item
from app.storage.vectors import add_embedding


def ingest_item(image_path: str, tags: dict) -> dict:
    saved = add_item(image_path, tags)
    add_embedding(saved["id"], tags)
    return saved
