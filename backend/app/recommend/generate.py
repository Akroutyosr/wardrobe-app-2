"""
Generation step: given a shortlist of real wardrobe items, ask an LLM to
compose 3-5 complete outfits with reasoning, grounded strictly in the
shortlist. Validates that every referenced item ID actually exists in
the shortlist, to catch any hallucinated references.
"""

import json
import os
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from google import genai
from google.genai import types

from app.recommend.context import OutfitContext
from app.storage.db import get_item, save_generated_outfit

# Load the backend .env from the project root when available.
env_path = find_dotenv(usecwd=True)
if env_path:
    load_dotenv(env_path)
else:
    # Fallback to a relative .env path in case the script is run from another cwd.
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / ".env")

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set."
                " Copy backend/.env.example to backend/.env and add your Gemini API key,"
                " or set GEMINI_API_KEY in your environment before running the CLI."
            )
        _client = genai.Client(api_key=api_key)
    return _client


OUTFIT_SCHEMA = {
    "type": "object",
    "properties": {
        "outfits": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item_ids": {"type": "array", "items": {"type": "string"}},
                    "reasoning": {"type": "string"},
                },
                "required": ["item_ids", "reasoning"],
            },
        }
    },
    "required": ["outfits"],
}


def _build_prompt(shortlist: list[dict], context: OutfitContext) -> str:
    items_desc = "\n".join(
        f"- id={item['id']}: {item['category']}/{item['subcategory']}, "
        f"{item['primary_color']}"
        + (f"/{item['secondary_color']}" if item.get("secondary_color") else "")
        + f", {item['pattern']}, formality={item['formality']}, seasons={item['seasons']}"
        for item in shortlist
    )

    context_desc = []
    if context.occasion:
        context_desc.append(f"Occasion: {context.occasion}")
    if context.season:
        context_desc.append(f"Season: {context.season}")
    if context.notes:
        context_desc.append(f"Notes: {context.notes}")
    if context.anchor_item_id:
        context_desc.append(f"Build the outfit(s) around item id={context.anchor_item_id}")

    # Few-shot preference signal from recent feedback, if any exists yet.
    from app.storage.db import get_recent_rated_outfits
    recent = get_recent_rated_outfits(limit=5)
    feedback_desc = ""
    if recent:
        liked = [o for o in recent if o["rating"] >= 4]
        disliked = [o for o in recent if o["rating"] <= 2]
        lines = []
        for o in liked:
            desc = ", ".join(f"{i['category']}/{i['subcategory']} ({i['primary_color']})" for i in o["items"])
            lines.append(f"LIKED (rated {o['rating']}/5): {desc}")
        for o in disliked:
            desc = ", ".join(f"{i['category']}/{i['subcategory']} ({i['primary_color']})" for i in o["items"])
            lines.append(f"DISLIKED (rated {o['rating']}/5): {desc}")
        if lines:
            feedback_desc = (
                "\n\nThe user's recent feedback on past outfit suggestions "
                "(use this to inform style/color/formality preferences -- "
                "identify WHY it worked, e.g. the color palette or formality "
                "level, and apply that reasoning to a DIFFERENT combination "
                "of items where possible, rather than reassembling the exact "
                "same pieces):\n" + "\n".join(lines)
            )
    else:
        # Cold start: no real wear history yet, fall back to quiz signal if present
        from app.storage.db import get_style_preference_summary
        prefs = get_style_preference_summary()
        if prefs:
            feedback_desc = (
                f"\n\nNo wear history yet, but the user's style quiz suggests a lean toward "
                f"formality ~{prefs['avg_formality']}, {prefs['preferred_pattern']} patterns, "
                f"and {prefs['preferred_color_family']} tones. Use this as a loose starting "
                f"signal, not a hard rule."
            )

    return f"""You are a personal stylist. Here is a shortlist of REAL clothing
items the person actually owns -- you may ONLY reference items by the exact
id values shown below. Never invent an item or id that isn't in this list.

ITEMS:
{items_desc}

CONTEXT:
{chr(10).join(context_desc) if context_desc else 'No specific context -- general everyday outfit.'}
{feedback_desc}

A complete outfit MUST include, at minimum: one top-half garment (top,
blouse, shirt, sweater, etc.) OR a dress, AND one bottom-half garment
(pants, jeans, skirt, etc.) UNLESS a dress is used instead of top+bottom,
PLUS shoes. Accessories, bags, and outerwear are optional additions on top
of that base -- never the entire outfit by themselves. If the shortlist is
missing a category needed to complete an outfit around the anchor item,
say so explicitly in the reasoning rather than submitting an incomplete
outfit.

Compose 3-5 complete, coordinated outfits using color theory (avoid clashing
bold patterns, balance formality across pieces) and the given context.
Each outfit should reference 2-4 item ids. Give one short, warm sentence of
reasoning per outfit explaining why it works.

If the CONTEXT includes weather notes (e.g. "17°C and clear"), reference the
real temperature and condition explicitly in the reasoning -- for example
"keeps you cool on today's 17°C clear day". Concretely echo the number and
the condition rather than vague phrasing like "great for warmer weather".
"""


def generate_outfits(shortlist: list[dict], context: OutfitContext) -> list[dict]:
    if not shortlist:
        return []

    valid_ids = {item["id"] for item in shortlist}
    client = _get_client()
    model_name = os.environ.get("GEMINI_MODEL", "models/gemini-3.1-flash-lite")

    response = client.models.generate_content(
        model=model_name,
        contents=_build_prompt(shortlist, context),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=OUTFIT_SCHEMA,
        ),
    )

    data = json.loads(response.text)
    outfits = data.get("outfits", [])

    # Validate: drop any outfit referencing an id not in the shortlist --
    # this is the guard against hallucinated items.
    validated = []
    for outfit in outfits:
        ids = outfit.get("item_ids", [])
        if all(i in valid_ids for i in ids) and ids:
            validated.append(outfit)
        else:
            print(f"Dropped outfit with invalid item id(s): {ids}")

    # Programmatic completeness check -- the prompt asks the model to flag
    # (not submit) an incomplete outfit, but that instruction alone wasn't
    # reliable in testing, so verify structurally here too.
    TOP_HALF = {"top", "outerwear"}
    complete_outfits = []
    for outfit in validated:
        items = [get_item(i) for i in outfit["item_ids"]]
        categories = {i["category"] for i in items}
        has_shoes = "shoes" in categories
        has_dress = "dress" in categories
        has_top = "top" in categories or bool(categories & TOP_HALF - {"outerwear"})
        has_bottom = "bottom" in categories
        if has_shoes and (has_dress or (has_top and has_bottom)):
            complete_outfits.append(outfit)
        else:
            print(f"Dropped structurally incomplete outfit: {outfit['item_ids']} (categories={categories})")
    validated = complete_outfits

    # Programmatic safety net: prompt alone didn't reliably stop exact
    # repeats of liked outfits in testing, so filter them out here too.
    from app.storage.db import get_recent_rated_outfits
    liked_item_sets = [
        frozenset(o["id"] for o in outfit["items"])
        for outfit in get_recent_rated_outfits(limit=10)
        if outfit["rating"] >= 4
    ]

    non_repeated = [
        outfit for outfit in validated
        if frozenset(outfit["item_ids"]) not in liked_item_sets
    ]

    if len(non_repeated) < len(validated):
        print(f"Filtered {len(validated) - len(non_repeated)} outfit(s) that exactly repeated a previously liked combination.")

    final_list = non_repeated if non_repeated else validated

    # Persist every surviving outfit now so it has a stable id for
    # deep-linking (/look/<id>) even before it's ever rated.
    persisted_outfits = []
    for outfit in final_list:
        outfit_id = save_generated_outfit(
            outfit["item_ids"], outfit["reasoning"], vars(context)
        )
        persisted_outfits.append({
            "id": outfit_id,
            "item_ids": outfit["item_ids"],
            "reasoning": outfit["reasoning"],
        })

    return persisted_outfits
