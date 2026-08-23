"""
HTTP-facing data shapes for the Phase 6 FastAPI layer.

Kept separate from main.py so the endpoint wiring stays readable and the
DTO mapping (backend vocab -> frontend vocab) lives in one place.

Category vocabulary: the backend tags items as top/bottom/outerwear/shoes/
accessory/dress, but the web frontend groups them as tops/bottoms/shoes/
outerwear/accessories. Mapping here keeps the existing UI working untouched.
"""

from pathlib import Path

from pydantic import BaseModel, Field

from app.recommend.context import OutfitContext
from app.storage.db import get_item, get_wear_counts

PHOTO_DIR = Path(__file__).resolve().parents[1] / "data" / "photos"
CUTOUT_DIR = Path(__file__).resolve().parents[1] / "data" / "cutouts"

CATEGORY_TO_FRONTEND = {
    "top": "tops",
    "bottom": "bottoms",
    "shoes": "shoes",
    "outerwear": "outerwear",
    "accessory": "accessories",
    "dress": "tops",  # frontend has no separate "dresses" bucket; mock dresses live under tops
}

# Reverse mapping so a category filter from the frontend hits the right DB rows.
# "tops" maps to both "top" and "dress" rows so dresses still appear under tops.
FRONTEND_TO_CATEGORY = {
    "tops": ["top", "dress"],
    "bottoms": ["bottom"],
    "shoes": ["shoes"],
    "outerwear": ["outerwear"],
    "accessories": ["accessory"],
}

# Frontend mock colors: normalize any primary color toward these base names so
# the closet color filter chips keep working against real data.
COLOR_BASE = {
    "burgundy": "red",
    "maroon": "red",
    "brick": "red",
    "coral": "coral",
    "navy": "navy",
    "denim": "blue",
    "sky": "blue",
    "azure": "blue",
    "cream": "cream",
    "ivory": "cream",
    "beige": "cream",
    "oatmeal": "cream",
    "tan": "tan",
    "caramel": "tan",
    "camel": "camel",
    "black": "black",
    "charcoal": "black",
    "white": "white",
    "grey": "gray",
    "gray": "gray",
    "olive": "green",
    "forest": "green",
    "khaki": "green",
    "mint": "mint",
    "lavender": "lavender",
    "purple": "purple",
    "gold": "gold",
    "mustard": "gold",
    "silver": "silver",
    "pink": "pink",
    "rose": "pink",
    "rust": "orange",
    "orange": "orange",
    "brown": "brown",
    "navy blue": "navy",
}

FORMALITY_LABEL = {
    1: "very casual",
    2: "casual",
    3: "smart casual",
    4: "smart",
    5: "formal",
}


def normalize_color(value: str | None) -> str:
    """Map a backend color to the closest base color name the UI knows."""
    if not value:
        return ""
    base = str(value).strip().lower()
    if base in COLOR_BASE:
        return COLOR_BASE[base]
    # strip leading shade modifiers ("dark red" -> "red")
    words = base.split()
    if len(words) > 1:
        head = words[0]
        if head in {"dark", "light", "medium", "pale", "deep", "bright", "off", "dusty", "soft", "muted", "washed"}:
            return COLOR_BASE.get(words[1], words[1])
    return base


def item_image_url(item: dict) -> str:
    """Resolve a stored image_path to a servable URL, or '' if the file is gone."""
    raw = item.get("image_path") or ""
    if not raw:
        return ""
    name = Path(raw).name
    if (PHOTO_DIR / name).exists():
        return f"/photos/{name}"
    return ""


def item_cutout_url(item: dict) -> str:
    """Resolve an item's transparent cutout to a servable URL. The filename is
    derived deterministically from the source photo (cutout_<photo-stem>.png),
    so cutouts render even before the cutout_path column is backfilled."""
    raw = item.get("image_path") or ""
    if not raw:
        return ""
    cutout_name = f"cutout_{Path(raw).stem}.png"
    if (CUTOUT_DIR / cutout_name).exists():
        return f"/cutouts/{cutout_name}"
    return ""


def item_to_dto(item: dict) -> dict:
    """Backend item row -> frontend ClosetItem-shaped JSON."""
    category = item.get("category", "")
    item_id = item.get("id", "")
    subcategory = item.get("subcategory") or category
    primary_color = item.get("primary_color") or ""

    name_parts = [primary_color, subcategory]
    name = " ".join(p for p in name_parts if p).strip().capitalize() or "New item"

    return {
        "id": item_id,
        "name": name,
        "image": item_image_url(item),
        "cutout": item_cutout_url(item),
        "category": CATEGORY_TO_FRONTEND.get(category, category),
        "color": normalize_color(primary_color),
        "primary_color": primary_color,
        "subcategory": subcategory,
        "pattern": item.get("pattern", ""),
        "formality": item.get("formality", 3),
        "formality_label": FORMALITY_LABEL.get(item.get("formality"), "casual"),
        "seasons": item.get("seasons", []),
        "fabric_guess": item.get("fabric_guess", ""),
        "notes": item.get("notes", ""),
        "worn": item.get("worn", 0),
        "price": item.get("price"),
        "cost_per_wear": item.get("cost_per_wear"),
    }


def decorate_with_wear_counts(items: list[dict]) -> list[dict]:
    counts = get_wear_counts()
    for item in items:
        worn = counts.get(item["id"], 0)
        item["worn"] = worn
        # Cost-per-wear rides along here (rows already carry price) so the
        # closet grid gets badges without N extra API calls.
        item["cost_per_wear"] = (
            round(item["price"] / worn, 2) if item.get("price") and worn > 0 else None
        )
    return items


# --- Request/response models -------------------------------------------------

class ItemQuery(BaseModel):
    category: str | None = None
    season: str | None = None


class OutfitRequest(BaseModel):
    occasion: str | None = None
    season: str | None = None
    min_formality: int | None = Field(default=None, ge=1, le=5)
    max_formality: int | None = Field(default=None, ge=1, le=5)
    anchor_item_id: str | None = None
    notes: str = ""

    def to_context(self) -> OutfitContext:
        return OutfitContext(
            occasion=self.occasion,
            season=self.season,
            min_formality=self.min_formality,
            max_formality=self.max_formality,
            anchor_item_id=self.anchor_item_id,
            notes=self.notes,
        )


class FeedbackRequest(BaseModel):
    item_ids: list[str]
    rating: int = Field(ge=1, le=5)
    worn_on: str | None = None


def outfit_to_dto(outfit: dict, index: int, worn_counts: dict[str, int]) -> dict:
    """An LLM-generated outfit -> display shape with resolved item details."""
    item_ids = outfit["item_ids"]
    items = []
    for item_id in item_ids:
        row = get_item(item_id)
        if row:
            row["worn"] = worn_counts.get(item_id, 0)
            items.append(item_to_dto(row))

    parts = [d["subcategory"] for d in items[:3]]
    title = " · ".join(p.capitalize() for p in parts) or f"Look {index + 1}"

    return {
        "id": outfit.get("id") or f"gen-{index + 1}",
        "title": title,
        "caption": outfit.get("reasoning", ""),
        "item_ids": item_ids,
        "items": items,
        "saved": bool(outfit.get("is_saved", False)),
        "rating": outfit.get("rating"),
    }
