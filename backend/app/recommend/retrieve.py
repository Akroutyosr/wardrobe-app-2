"""
Retrieval step of the RAG outfit engine: hard-filter candidates by
structured constraints (season, formality), then optionally rank by
vector similarity to an anchor item. Returns a small shortlist -- the
LLM composition step only ever sees this shortlist, so it can't
reference items you don't actually own.
"""

from app.recommend.context import OutfitContext
from app.storage.db import get_item, list_items
from app.storage.vectors import find_similar, item_to_text

MAX_SHORTLIST = 20


def retrieve_candidates(context: OutfitContext) -> list[dict]:
    all_items = list_items(season=context.season)

    if context.min_formality is not None:
        all_items = [i for i in all_items if i["formality"] >= context.min_formality]
    if context.max_formality is not None:
        all_items = [i for i in all_items if i["formality"] <= context.max_formality]

    if context.anchor_item_id:
        anchor = get_item(context.anchor_item_id)
        if anchor:
            query_text = item_to_text(anchor)
            similar = find_similar(query_text, k=MAX_SHORTLIST)
            similar_ids = {r["item_id"] for r in similar}
            shortlist = [i for i in all_items if i["id"] in similar_ids or i["id"] == context.anchor_item_id]
        else:
            shortlist = all_items[:MAX_SHORTLIST]
    else:
        shortlist = all_items[:MAX_SHORTLIST]

    # Guarantee category coverage regardless of path -- a shortlist missing
    # an entire base category (top/bottom/dress/shoes) can't produce a
    # complete outfit no matter what the generation prompt says.
    present_categories = {i["category"] for i in shortlist}
    needed_categories = {"top", "bottom", "dress", "shoes"} - present_categories
    if needed_categories:
        already_in = {i["id"] for i in shortlist}
        fillers = [i for i in all_items if i["category"] in needed_categories and i["id"] not in already_in]
        shortlist.extend(fillers[:MAX_SHORTLIST - len(shortlist)])

    return shortlist[:MAX_SHORTLIST]
