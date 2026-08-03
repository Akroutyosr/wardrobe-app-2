"""
Phase 1 core: photo in, validated ClothingItem out.

Usage:
    from app.tagging.tagger import tag_photo
    item = tag_photo("data/photos/blue_shirt.jpg")
    print(item.model_dump_json(indent=2))
"""

import base64
import io
import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
from pydantic import ValidationError

from app.tagging.schema import ClothingItem, TAGGING_SYSTEM_PROMPT

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = REPO_ROOT / "data" / "tagging_logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY not set. Copy .env.example to .env and add your free-tier key "
                "from https://aistudio.google.com/apikey"
            )
        _client = genai.Client(api_key=api_key)
    return _client


def _log_raw_response(image_path: str, raw_text: str, attempt: int, provider: str) -> None:
    stamp = time.strftime("%Y%m%d-%H%M%S")
    log_path = LOG_DIR / f"{Path(image_path).stem}_{stamp}_{provider}_attempt{attempt}.txt"
    log_path.write_text(raw_text, encoding="utf-8")


def _is_quota_error(exc: Exception) -> bool:
    """True when the Gemini call failed for a quota / rate-limit / availability reason."""
    message = str(exc).lower()
    markers = (
        "429",
        "quota",
        "rate limit",
        "resource exhausted",
        "no longer available",
        "404",
        "not_found",
    )
    return any(m in message for m in markers)


def _tag_with_gemini(image: Image.Image, schema: dict) -> tuple[str, str]:
    client = _get_client()
    model_name = os.environ.get("GEMINI_MODEL", "models/gemini-3.1-flash-lite")
    prompt = TAGGING_SYSTEM_PROMPT

    last_error = None
    for attempt in range(1, 4):  # first try + retries
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[image, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            return response.text, "gemini"
        except Exception as e:
            last_error = e
            if _is_quota_error(e):
                raise
            # Tell the model exactly what went wrong and ask it to fix it.
            prompt = (
                TAGGING_SYSTEM_PROMPT
                + f"\n\nYour previous response was invalid: {e}\n"
                + "Return ONLY valid JSON matching the required schema, nothing else."
            )

    raise RuntimeError(f"Gemini failed after retries: {last_error}")


def _tag_with_ollama(image: Image.Image, schema: dict) -> tuple[str, str]:
    """Tag the photo using a local Ollama vision model via its HTTP API."""
    model_name = os.environ.get("OLLAMA_MODEL", "qwen2.5vl:3b")
    endpoint = os.environ.get("OLLAMA_HOST", "http://localhost:11434") + "/api/generate"

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    prompt = (
        TAGGING_SYSTEM_PROMPT
        + "\nRespond with ONLY valid JSON matching the schema provided."
    )

    payload = {
        "model": model_name,
        "prompt": prompt,
        "images": [image_b64],
        "format": "json",
        "stream": False,
    }

    last_error = None
    for attempt in range(1, 3):
        try:
            resp = requests.post(endpoint, json=payload, timeout=180)
            resp.raise_for_status()
            data = resp.json()
            if "response" not in data:
                raise RuntimeError(f"Ollama returned no response: {data}")
            return data["response"], "ollama"
        except Exception as e:
            last_error = e
            prompt = (
                TAGGING_SYSTEM_PROMPT
                + f"\n\nYour previous response was invalid: {e}\n"
                + "Return ONLY valid JSON matching the required schema, nothing else."
            )

    raise RuntimeError(f"Ollama failed after retries: {last_error}")


def tag_photo(image_path: str, max_retries: int = 2) -> ClothingItem:
    """
    Send a single clothing item photo to Gemini and return a validated ClothingItem.

    Falls back to a local Ollama vision model if the Gemini call fails for a
    quota / rate-limit / model-availability reason, so eval runs don't grind
    to a halt when the free tier is exhausted.

    Raises RuntimeError if neither provider can produce valid output after all
    retries -- this is deliberate: silently returning a broken/empty item would
    poison your wardrobe data and your eval numbers.
    """
    image = Image.open(image_path)
    schema = ClothingItem.model_json_schema()

    providers = [_tag_with_gemini, _tag_with_ollama]

    for i, provider_fn in enumerate(providers):
        try:
            raw_text, provider = provider_fn(image, schema)
            _log_raw_response(image_path, raw_text, 1, provider)
            data = json.loads(raw_text)
            return ClothingItem.model_validate(data)
        except Exception as e:
            if i < len(providers) - 1:
                # Try the next provider (Gemini -> Ollama).
                continue
            raise RuntimeError(
                f"Failed to get valid tags for {image_path}. "
                f"Gemini and Ollama both failed. Last error: {e}. "
                "Check data/tagging_logs/ for raw model output."
            )


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("Usage: python -m app.tagging.tagger <path_to_photo>")
        sys.exit(1)

    result = tag_photo(sys.argv[1])
    print(result.model_dump_json(indent=2))
