"""
Phase 6: FastAPI HTTP layer exposing the Phase 1-5 pipeline (tagging, wardrobe
storage, RAG outfit generation, shopping agent) as REST endpoints for the web
frontend.

Run from the backend/ directory:

    uvicorn app.main:app --reload --port 8000

Health check: GET http://localhost:8000/api/health
Interactive docs: GET http://localhost:8000/docs
"""

import shutil
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.api import (
    PHOTO_DIR,
    FeedbackRequest,
    FRONTEND_TO_CATEGORY,
    OutfitRequest,
    decorate_with_wear_counts,
    item_to_dto,
    outfit_to_dto,
)
from app.agent.orchestrator import evaluate_purchase
from app.recommend.generate import generate_outfits
from app.recommend.retrieve import retrieve_candidates
from app.storage.db import get_item, get_wear_counts, list_items, log_outfit_wear
from app.storage.ingest import ingest_item
from app.storage.vectors import find_similar, item_to_text
from app.tagging.schema import ClothingItem
from app.tagging.tagger import tag_photo


class AddItemRequest(BaseModel):
    image_path: str = Field(default="", description="Photo path returned by /api/items/upload")
    tags: ClothingItem

app = FastAPI(title="Digital Wardrobe Twin API", version="0.1.0")

# Dev default: any origin. Tighten this once the frontend has a real host.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wardrobe photos live under backend/data/photos — serve them as static files
# so the frontend can point <img src> straight at them.
PHOTO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/photos", StaticFiles(directory=str(PHOTO_DIR)), name="photos")


def _save_upload(upload: UploadFile) -> str:
    """Persist an uploaded photo into the photos dir and return its path."""
    safe = Path(upload.filename or "upload.jpg").name
    dest = PHOTO_DIR / safe
    with dest.open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    return str(dest)


@app.get("/api/health")
def health() -> dict:
    try:
        item_count = len(list_items())
    except Exception as exc:  # pragma: no cover - defensive
        return {"status": "error", "detail": str(exc)}
    return {
        "status": "ok",
        "service": "wardrobe-backend",
        "items": item_count,
        "photos_dir": str(PHOTO_DIR),
    }


@app.get("/api/items")
def api_list_items(category: str | None = None, season: str | None = None) -> list[dict]:
    if category:
        backend_cats = FRONTEND_TO_CATEGORY.get(category)
        if backend_cats is None:
            # Not a frontend category name — treat as an already-backend category.
            backend_cats = [category]
        if len(backend_cats) == 1:
            rows = list_items(category=backend_cats[0], season=season)
        else:
            # Multi-valued (tops -> top + dress): fetch both and merge.
            merged: dict[str, dict] = {}
            for cat in backend_cats:
                for row in list_items(category=cat, season=season):
                    merged[row["id"]] = row
            rows = list(merged.values())
        decorate_with_wear_counts(rows)
        return [item_to_dto(row) for row in rows]
    rows = list_items(category=None, season=season)
    decorate_with_wear_counts(rows)
    return [item_to_dto(row) for row in rows]


@app.get("/api/items/{item_id}")
def api_get_item(item_id: str) -> dict:
    row = get_item(item_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"No item with id {item_id}")
    row["worn"] = get_wear_counts().get(item_id, 0)
    return item_to_dto(row)


@app.get("/api/items/{item_id}/similar")
def api_similar(item_id: str, k: int = 5) -> list[dict]:
    row = get_item(item_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"No item with id {item_id}")
    results = find_similar(item_to_text(row), k=k)
    out = []
    counts = get_wear_counts()
    for r in results:
        match = get_item(r["item_id"])
        if match is None:
            continue
        match["worn"] = counts.get(match["id"], 0)
        dto = item_to_dto(match)
        dto["distance"] = r["distance"]
        out.append(dto)
    return out


@app.post("/api/outfits/generate")
def api_generate_outfits(req: OutfitRequest) -> dict:
    shortlist = retrieve_candidates(req.to_context())
    generated = generate_outfits(shortlist, req.to_context())
    counts = get_wear_counts()
    return {
        "context": req.model_dump(exclude_none=True),
        "outfits": [
            outfit_to_dto(outfit, i, counts) for i, outfit in enumerate(generated)
        ],
    }


@app.post("/api/feedback")
def api_feedback(req: FeedbackRequest) -> dict:
    outfit_id = log_outfit_wear(req.item_ids, req.rating, req.worn_on)
    return {"outfit_id": outfit_id, "item_ids": req.item_ids, "rating": req.rating}


@app.post("/api/items/upload")
async def api_upload_item(upload: UploadFile = File(...)) -> dict:
    """Tag an uploaded photo without saving it — the frontend review step."""
    image_path = _save_upload(upload)
    item = tag_photo(image_path)
    return {"image_path": image_path, "tags": item.model_dump()}


@app.post("/api/items")
def api_add_item(req: AddItemRequest) -> dict:
    """Save a reviewed, tagged item to the wardrobe (SQLite + Chroma)."""
    saved = ingest_item(req.image_path, req.tags.model_dump())
    return item_to_dto(saved)


@app.post("/api/should-i-buy")
async def api_should_i_buy(upload: UploadFile = File(...)) -> dict:
    """Run the shopping decision agent on a photo of a prospective purchase."""
    image_path = _save_upload(upload)
    verdict, tool_log = evaluate_purchase(image_path, verbose=False)
    new_item = tag_photo(image_path).model_dump()
    return {
        "image_path": image_path,
        "verdict": verdict,
        "tool_log": tool_log,
        "new_item": new_item,
    }
