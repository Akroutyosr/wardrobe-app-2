"""
Phase 6: FastAPI HTTP layer exposing the Phase 1-5 pipeline (tagging, wardrobe
storage, RAG outfit generation, shopping agent) as REST endpoints for the web
frontend.

Run from the backend/ directory:

    uvicorn app.main:app --reload --port 8000

Health check: GET http://localhost:8000/api/health
Interactive docs: GET http://localhost:8000/docs
"""

import os
import shutil
import threading
from pathlib import Path

import psycopg

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from app.api import (
    CUTOUT_DIR,
    PHOTO_DIR,
    FeedbackRequest,
    FRONTEND_TO_CATEGORY,
    OutfitRequest,
    decorate_with_wear_counts,
    item_to_dto,
    normalize_color,
    outfit_to_dto,
)
from app.agent.orchestrator import evaluate_purchase
from app.recommend.generate import generate_outfits
from app.recommend.retrieve import retrieve_candidates
from app.storage.db import (
    REPO_ROOT,
    create_tryon_session,
    delete_fitting_photo,
    get_distinct_colors,
    get_generated_outfit,
    get_item,
    get_outfits_for_week,
    get_recent_outfit_deck,
    get_saved_fitting_photo,
    get_tryon_session,
    get_wear_counts,
    list_items,
    log_outfit_wear,
    rate_generated_outfit,
    save_fitting_photo,
    save_quiz_preference,
    update_tryon_session,
)
from app.storage.ingest import ingest_item
from app.storage.vectors import find_similar, item_to_text
from app.tagging.schema import ClothingItem
from app.tagging.tagger import tag_photo
from app.tryon.vton_client import try_on


class AddItemRequest(BaseModel):
    image_path: str = Field(default="", description="Photo path returned by /api/items/upload")
    tags: ClothingItem

app = FastAPI(title="Digital Wardrobe Twin API", version="0.1.0")


@app.exception_handler(psycopg.OperationalError)
async def _db_unreachable(_request: Request, exc: psycopg.OperationalError):
    """Database egress is down (e.g. the Supabase pooler is unreachable). Fail
    fast with a clean 503 instead of crashing the request with a traceback."""
    return JSONResponse(
        status_code=503,
        content={"detail": "The wardrobe database is unreachable right now. Try again in a moment."},
    )

def _cors_origins() -> list[str]:
    """Allowed browser origins for the frontend. Set CORS_ORIGINS (comma-
    separated) on the deployed backend, e.g. https://wardrobe.pages.dev; falls
    back to local dev origins when unset."""
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
    ]


# Tightened from a dev-only wildcard: only the local dev servers and any origin
# listed in CORS_ORIGINS (deployed frontends) may call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wardrobe photos live under backend/data/photos — served with a long cache
# header (filenames are content hashes for uploaded/ingested items) so browsers
# and any CDN cache them instead of re-hitting the free-tier instance on every
# page navigation.
PHOTO_DIR.mkdir(parents=True, exist_ok=True)

# Fitting-room try-on results (composited images) live under data/fitting_room.
FITTING_DIR = REPO_ROOT / "data" / "fitting_room"
FITTING_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/photos/{name}")
def photo(name: str) -> FileResponse:
    path = PHOTO_DIR / Path(name).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")
    media_type = "image/png" if path.suffix.lower() == ".png" else None
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )


@app.get("/cutouts/{name}")
def cutout(name: str) -> FileResponse:
    path = CUTOUT_DIR / Path(name).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Cutout not found")
    return FileResponse(
        path,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )


@app.get("/fitting-room/{name}")
def fitting_room_result(name: str) -> FileResponse:
    """Serve composited try-on results. Private to the session that made them,
    so no CDN cache -- a result can be deleted at any time."""
    path = FITTING_DIR / Path(name).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Try-on result not found")
    return FileResponse(path, media_type="image/png")


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
    ctx = req.to_context()
    # Reuse the last persisted deck for this exact context when it's fresh, so
    # repeat visits (home page) skip the slow LLM round-trip.
    deck = get_recent_outfit_deck(vars(ctx))
    if not deck:
        shortlist = retrieve_candidates(ctx)
        deck = generate_outfits(shortlist, ctx)
    counts = get_wear_counts()
    return {
        "context": req.model_dump(exclude_none=True),
        "outfits": [
            outfit_to_dto(outfit, i, counts) for i, outfit in enumerate(deck)
        ],
    }


@app.get("/api/outfits/{outfit_id}")
def api_get_outfit(outfit_id: str) -> dict:
    outfit = get_generated_outfit(outfit_id)
    if outfit is None:
        raise HTTPException(status_code=404, detail=f"No outfit with id {outfit_id}")
    return outfit


@app.get("/api/planner/week")
def api_planner_week(start_date: str, end_date: str) -> dict:
    """Weekly Planner: generated outfits for [start_date, end_date], one per
    day, resolved into the same DTO the deck endpoints return."""
    rows = get_outfits_for_week(start_date, end_date)
    counts = get_wear_counts()
    outfits = []
    for idx, row in enumerate(rows):
        dto = outfit_to_dto(row, idx, counts)
        dto["date"] = str(row["day"])
        dto["rating"] = row.get("rating")
        outfits.append(dto)
    return {"outfits": outfits}


class QuizPreferenceRequest(BaseModel):
    formality: int
    pattern: str
    color_family: str


@app.post("/api/quiz/preference")
def api_quiz_preference(req: QuizPreferenceRequest):
    save_quiz_preference(req.formality, req.pattern, req.color_family)
    return {"status": "ok"}


class RateOutfitRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    worn_on: str | None = None


@app.post("/api/outfits/{outfit_id}/rate")
def api_rate_outfit(outfit_id: str, req: RateOutfitRequest) -> dict:
    try:
        rate_generated_outfit(outfit_id, req.rating, req.worn_on)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"status": "ok"}


@app.get("/api/colors")
def api_colors() -> list[str]:
    """Distinct colors actually present in the wardrobe, normalized to the
    base color names the UI chips understand (so chips always match filters)."""
    return sorted({normalize_color(c) for c in get_distinct_colors() if normalize_color(c)})


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


# --- Fitting room -------------------------------------------------------------
#
# The try-on pipeline composites ONE garment at a time onto the base photo
# (each pass's output feeds the next pass's input), so a full outfit is several
# sequential IDM-VTON calls. Sessions persist progress so the frontend can show
# "Fitting 2 of 3: jeans…" rather than a bare spinner, and every step returns a
# servable result image that builds up the before/after.

# Categories IDM-VTON can meaningfully composite. Accessories/bags are skipped
# rather than producing a nonsense warp on a small garment crop.
GARMENT_CATEGORIES = ("top", "bottom", "outerwear", "dress", "shoes")


def _resolve_path(stored: str) -> Path:
    """Stored image paths may be absolute (uploads) or backend-relative
    (ingested data) -- resolve both to a real filesystem path."""
    path = Path(stored)
    return path if path.is_absolute() else REPO_ROOT / path


@app.post("/api/fitting-room/photo")
def api_upload_fitting_photo(
    photo: UploadFile = File(...),
    consent_to_save: bool = Form(False),
    x_device_id: str = Header(...),
):
    image_path = _save_upload(photo)  # reuse existing helper, saves under data/photos/
    photo_id = save_fitting_photo(x_device_id, image_path, consent_to_save)
    return {"photo_id": photo_id, "image_path": image_path}


@app.get("/api/fitting-room/photo/saved")
def api_get_saved_photo(x_device_id: str = Header(...)):
    photo = get_saved_fitting_photo(x_device_id)
    if photo is None:
        raise HTTPException(404, "No saved fitting room photo")
    return photo


@app.delete("/api/fitting-room/photo")
def api_delete_fitting_photo(x_device_id: str = Header(...)):
    delete_fitting_photo(x_device_id)
    return {"status": "deleted"}


def _run_try_on_pipeline(session_id: str, photo_path: str, garment_items: list[dict]) -> None:
    """Composite each garment onto the running photo, updating the session
    after every pass. Errors mark the session failed rather than throwing into
    the caller (this runs in a background thread after the HTTP response)."""
    current_photo = _resolve_path(photo_path)
    result_path = None
    try:
        for step, item in enumerate(garment_items, 1):
            garment_path = _resolve_path(item["image_path"])
            description = f"{item['pattern']} {item['primary_color']} {item['subcategory']}".strip()

            result_temp = try_on(current_photo, garment_path, description)

            out_filename = f"{session_id}_step{step}.png"
            out_path = FITTING_DIR / out_filename
            if result_temp.exists():
                result_temp.rename(out_path)
            result_path = f"data/fitting_room/{out_filename}"
            current_photo = out_path  # next item composites onto THIS output

            update_tryon_session(session_id, step, result_path, "in_progress")
        update_tryon_session(session_id, len(garment_items), result_path, "complete")
    except Exception as e:  # noqa: BLE001 - background task must never raise
        update_tryon_session(session_id, 0, str(result_path) if result_path else None, "failed")
        print(f"[fitting-room] session {session_id} failed: {e}", flush=True)


@app.post("/api/fitting-room/tryon")
def api_start_tryon(
    outfit_id: str = Form(...),
    photo_path: str = Form(...),  # from either fresh upload or the saved-photo endpoint
    x_device_id: str = Header(...),
):
    outfit = get_generated_outfit(outfit_id)
    if outfit is None:
        raise HTTPException(404, "Outfit not found")

    items = [get_item(i) for i in outfit["item_ids"] if get_item(i) is not None]
    garment_items = [i for i in items if i["category"] in GARMENT_CATEGORIES]
    if not garment_items:
        raise HTTPException(400, "This outfit has no items IDM-VTON can composite")

    session_id = create_tryon_session(
        x_device_id, photo_path, outfit_id, total_steps=len(garment_items)
    )

    # The pipeline is slow (one model pass per garment) and the frontend polls
    # the session for progress, so run it in a background thread after the
    # session id is handed back — never block the POST for the whole run.
    thread = threading.Thread(
        target=_run_try_on_pipeline,
        args=(session_id, photo_path, garment_items),
        daemon=True,
    )
    thread.start()
    return {"session_id": session_id, "result_image_path": None}


@app.get("/api/fitting-room/session/{session_id}")
def api_get_session(session_id: str):
    session = get_tryon_session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    return session
