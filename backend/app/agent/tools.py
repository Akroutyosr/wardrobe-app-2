"""
Tool implementations for the shopping decision agent. Each function here
is a plain Python function reused from Phases 1-3 -- the agent's job is
to decide WHICH of these to call and in WHAT order, not to reinvent any
of the underlying logic.
"""

from app.storage.db import list_items
from app.storage.vectors import find_similar, item_to_text
from app.tagging.tagger import tag_photo

DUPLICATE_DISTANCE_THRESHOLD = 0.5  # below this = "similar enough to flag"

# Rough category-pairing rules for versatility scoring -- not exhaustive,
# just enough signal to be useful. A "pairs with" relationship is symmetric.
COMPLEMENTARY_CATEGORIES = {
    "top": {"bottom", "shoes", "outerwear", "accessory"},
    "bottom": {"top", "shoes", "outerwear", "accessory", "dress"},
    "dress": {"shoes", "outerwear", "accessory"},
    "outerwear": {"top", "bottom", "dress", "shoes", "accessory"},
    "shoes": {"top", "bottom", "dress", "outerwear", "accessory"},
    "accessory": {"top", "bottom", "dress", "outerwear", "shoes"},
}


def tag_new_item(image_path: str) -> dict:
    """Tag a photo of a prospective purchase. Returns the same structured
    tags used for wardrobe items, but does NOT save it anywhere -- this
    item isn't owned yet."""
    item = tag_photo(image_path)
    return item.model_dump()


def query_wardrobe(category: str | None = None, season: str | None = None) -> list[dict]:
    """Query the existing wardrobe, optionally filtered by category and/or season."""
    items = list_items(season=season)
    if category:
        items = [i for i in items if i["category"] == category]
    return items


def compute_versatility_score(new_item: dict, wardrobe: list[dict] | None = None) -> dict:
    """
    Heuristic versatility score: how many existing wardrobe items this new
    item could reasonably be worn with. Considers category complementarity
    and formality closeness (within 1 level).
    """
    if wardrobe is None:
        wardrobe = list_items()

    compatible_categories = COMPLEMENTARY_CATEGORIES.get(new_item["category"], set())
    compatible_items = [
        item for item in wardrobe
        if item["category"] in compatible_categories
        and abs(item["formality"] - new_item["formality"]) <= 1
    ]

    return {
        "versatility_score": len(compatible_items),
        "pairs_with": [
            {"id": i["id"], "category": i["category"], "subcategory": i["subcategory"]}
            for i in compatible_items[:10]  # cap for prompt size
        ],
        "total_wardrobe_size": len(wardrobe),
    }


def check_duplicates(new_item: dict) -> dict:
    """Flag existing wardrobe items that look near-identical to this new item."""
    query_text = item_to_text(new_item)
    similar = find_similar(query_text, k=5)
    duplicates = [r for r in similar if r["distance"] < DUPLICATE_DISTANCE_THRESHOLD]

    return {
        "has_likely_duplicates": len(duplicates) > 0,
        "duplicates": duplicates,
    }


# --- Tool schema declarations for the Gemini function-calling API ---
# Kept in plain dict/JSON-schema form (not Pydantic) since these describe
# the *interface* the model sees, separate from our internal data models.

TOOL_DECLARATIONS = [
    {
        "name": "tag_new_item",
        "description": "Tag a photo of a prospective purchase (an item the user does NOT yet own) to get its structured attributes.",
        "parameters": {
            "type": "object",
            "properties": {"image_path": {"type": "string", "description": "Path to the photo"}},
            "required": ["image_path"],
        },
    },
    {
        "name": "query_wardrobe",
        "description": "Query the user's existing wardrobe, optionally filtered by category and/or season.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "top | bottom | outerwear | shoes | accessory | dress"},
                "season": {"type": "string", "description": "spring | summer | fall | winter"},
            },
        },
    },
    {
        "name": "compute_versatility_score",
        "description": "Given the new item's tags, compute how many existing wardrobe items it could reasonably be worn with.",
        "parameters": {
            "type": "object",
            "properties": {
                "new_item": {"type": "object", "description": "The tagged new item's attributes (from tag_new_item)"},
            },
            "required": ["new_item"],
        },
    },
    {
        "name": "check_duplicates",
        "description": "Check whether the user already owns something very similar to this new item.",
        "parameters": {
            "type": "object",
            "properties": {
                "new_item": {"type": "object", "description": "The tagged new item's attributes (from tag_new_item)"},
            },
            "required": ["new_item"],
        },
    },
]

TOOL_DISPATCH = {
    "tag_new_item": lambda args: tag_new_item(args["image_path"]),
    "query_wardrobe": lambda args: query_wardrobe(args.get("category"), args.get("season")),
    "compute_versatility_score": lambda args: compute_versatility_score(args["new_item"]),
    "check_duplicates": lambda args: check_duplicates(args["new_item"]),
}
