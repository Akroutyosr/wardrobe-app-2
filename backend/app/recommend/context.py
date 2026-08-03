"""
A recommendation context: the constraints an outfit needs to satisfy.
"""

from dataclasses import dataclass, field


@dataclass
class OutfitContext:
    occasion: str | None = None          # e.g. "work", "casual", "date night", "formal event"
    season: str | None = None            # "spring" | "summer" | "fall" | "winter"
    min_formality: int | None = None
    max_formality: int | None = None
    anchor_item_id: str | None = None    # build the outfit around this specific item
    notes: str = ""                      # free-text extra context, e.g. "rainy and cold"
