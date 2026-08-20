"""
Takes quiz answers + wardrobe DNA and produces:
1. A named style personality with description
2. Three specific gap-based shopping recommendations
3. Axis scores (casual/formal, minimal/maximal, timeless/trendy) for the meter UI
"""

import json
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

PERSONALITY_SCHEMA = {
    "type": "object",
    "properties": {
        "personality_name": {"type": "string"},
        "personality_tagline": {"type": "string"},
        "personality_description": {"type": "string"},
        "axis_scores": {
            "type": "object",
            "properties": {
                "casual_formal": {"type": "number"},    # 0-100, 0=very casual
                "minimal_maximal": {"type": "number"},  # 0-100, 0=very minimal
                "timeless_trendy": {"type": "number"},  # 0-100, 0=very timeless
            }
        },
        "wardrobe_strengths": {"type": "array", "items": {"type": "string"}},
        "wardrobe_gaps": {"type": "array", "items": {"type": "string"}},
        "shopping_recommendations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item_type": {"type": "string"},
                    "reason": {"type": "string"},
                    "suggested_color": {"type": "string"},
                    "priority": {"type": "string"},  # "high" | "medium" | "low"
                }
            }
        }
    },
    "required": ["personality_name", "personality_tagline", "personality_description",
                 "axis_scores", "wardrobe_strengths", "wardrobe_gaps", "shopping_recommendations"]
}

PERSONALITIES = """
Use one of these named personalities (or invent a better one if none fits):
- The Quiet Minimalist: neutral palette, clean lines, fewer but better pieces
- The Soft Romantic: florals, pastels, delicate details, feminine silhouettes
- The Effortless Classic: timeless basics, quality fabrics, rarely trends
- The Bold Maximalist: color, pattern mixing, statement pieces, lots of variety
- The Street Pragmatist: casual, functional, comfort-first, occasional edge
- The Power Dresser: structure, formality, confidence-first choices
- The Free Spirit: eclectic, vintage-adjacent, rule-breaking combinations
- The Capsule Builder: intentional, versatile, everything pairs with everything
"""

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set."
                " Copy backend/.env.example to backend/.env and add your Gemini API key,"
                " or set GEMINI_API_KEY in your environment."
            )
        _client = genai.Client(api_key=api_key)
    return _client


def analyze_quiz(answers: list[dict], wardrobe_dna: dict) -> dict:
    client = _get_client()
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    prompt = f"""You are a personal stylist analyzing someone's quiz answers and wardrobe data.

WARDROBE DNA:
{json.dumps(wardrobe_dna, indent=2)}

QUIZ ANSWERS (18 questions, each with the chosen option and its metadata):
{json.dumps(answers, indent=2)}

{PERSONALITIES}

Based on both the quiz answers AND the real wardrobe data:
1. Identify their style personality (named, memorable, specific to them)
2. Score them on 3 axes (0-100 each)
3. Name 2-3 genuine wardrobe strengths (based on what they actually own)
4. Name 2-3 real gaps (based on what's missing or underrepresented in their actual closet)
5. Give exactly 3 specific shopping recommendations that fill real gaps, prioritized by how much value they'd add

Be specific and personal -- reference their actual color palette and categories, not generic advice.
"""

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=PERSONALITY_SCHEMA,
        ),
    )
    return json.loads(response.text)