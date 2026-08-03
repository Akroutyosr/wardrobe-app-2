"""
The tagging schema is the contract every later phase (storage, embeddings,
RAG outfit engine, shopping agent) depends on. Keep it stable once you start
building on top of it -- if you need to change a field name later, you'll
need to migrate data/wardrobe.json and re-run the eval set.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field


Category = Literal["top", "bottom", "outerwear", "shoes", "accessory", "dress"]
Pattern = Literal["solid", "striped", "checked", "floral", "graphic", "other"]
Season = Literal["spring", "summer", "fall", "winter"]


class ClothingItem(BaseModel):
    category: Category = Field(description="Broad clothing category")
    subcategory: str = Field(description="Specific type, e.g. 't-shirt', 'chinos', 'ankle boots'")
    primary_color: str = Field(description="Human-readable primary color, e.g. 'navy blue'")
    secondary_color: Optional[str] = Field(
        default=None, description="Secondary color if present, else null"
    )
    pattern: Pattern
    formality: int = Field(
        ge=1, le=5, description="1 = very casual, 5 = formal"
    )
    seasons: list[Season] = Field(description="Seasons this item is appropriate for")
    fabric_guess: str = Field(description="Best-effort fabric guess from visual appearance")
    notes: str = Field(description="One short free-text description of the item")


# This is what gets sent to the model as the structured-output contract.
# Pydantic's model_json_schema() is passed directly to the Gemini SDK.
TAGGING_SYSTEM_PROMPT = """You are a clothing item tagger for a personal wardrobe app.
Look at the photo of a single clothing item and describe it precisely.
Only describe what you can actually see -- do not guess brand names.
If a field is genuinely ambiguous, make your best reasonable guess rather than leaving it vague.

For primary_color and secondary_color: use simple, common color names
(e.g. "brown", "cream", "red", "gray") rather than qualified shades
(avoid "dark brown", "off-white", "charcoal gray", "dark red") unless the
shade is truly central to identifying the item -- prefer the base color name.

For small design details that are secondary to the item's main color
(e.g. a small embroidered logo, a tiny accent emblem), mention them in
`notes` rather than in secondary_color, unless the accent covers a
meaningful portion of the visible surface.
"""
