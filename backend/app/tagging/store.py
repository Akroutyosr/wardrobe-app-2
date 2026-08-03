"""
Minimal JSON-file wardrobe store for Phase 1.

This is intentionally simple -- Phase 2 replaces this with SQLite + Chroma.
Keeping Phase 1 self-contained means you can build and trust the tagging
pipeline before adding any storage complexity.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
WARDROBE_FILE = REPO_ROOT / "data" / "wardrobe.json"


def _load() -> list[dict]:
    if not WARDROBE_FILE.exists():
        return []
    return json.loads(WARDROBE_FILE.read_text(encoding="utf-8"))


def _save(items: list[dict]) -> None:
    WARDROBE_FILE.write_text(json.dumps(items, indent=2), encoding="utf-8")


def add_item(image_path: str, tags: dict) -> dict:
    items = _load()
    item = {
        "id": str(uuid.uuid4())[:8],
        "image_path": image_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **tags,
    }
    items.append(item)
    _save(items)
    return item


def list_items() -> list[dict]:
    return _load()


def get_item(item_id: str) -> dict | None:
    for item in _load():
        if item["id"] == item_id:
            return item
    return None
