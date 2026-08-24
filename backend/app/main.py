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
from uuid import uuid4

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
from app.recommend.quiz_analysis import analyze_quiz
from app.storage.db import (
    REPO_ROOT,
    advance_challenges_for_wear,
    create_tryon_session,
    delete_fitting_photo,
    delete_item,
    generate_new_challenges,
    get_active_challenges,
    get_connection,
    get_current_streak,
    get_distinct_colors,
    get_generated_outfit,
    get_item_cost_per_wear,
    get_wardrobe_cpw_stats,
    get_wardrobe_dna,
    get_item,
    get_latest_quiz_result,
    get_outfits_for_week,
    get_planner_days,
    get_recent_outfit_deck,
    get_recent_rated_outfits,
    get_saved_outfits,
    get_saved_fitting_photo,
    get_tryon_session,
    get_wear_counts,
    get_cached_tags,
    init_db,
    list_items,
    log_outfit_wear,
    rate_generated_outfit,
    save_challenge,
    save_generated_outfit,
    save_fitting_photo,
    save_quiz_preference,
    save_quiz_result,
    save_tag_cache,
    set_outfit_saved,
    set_item_price,
    set_planner_day,
    suggest_todays_outfit,
    update_tryon_session,
    record_usage,
)
from app.storage.ingest import ingest_item
from app.storage.vectors import find_similar, item_to_text
from app.tagging.schema import ClothingItem
from app.tagging.tagger import tag_photo
from app.tryon.vton_client import try_on


class AddItemRequest(BaseModel):
    image_path: str = Field(default="", description="Photo path returned by /api/items/upload")
    tags: ClothingItem
    price: float | None = Field(default=None, ge=0, description="Optional purchase price")
    currency: str = "EUR"

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

# Face/body photos uploaded through the fitting room are private: they live in
# a gitignored directory (never committed, unlike wardrobe photos which are
# tracked so the Render free-tier's ephemeral disk still has them).
PERSONAL_PHOTOS_DIR = REPO_ROOT / "data" / "personal_uploads"
PERSONAL_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/personal-photos/{name}")
def personal_photo(name: str) -> FileResponse:
    """Serve a private face/body upload. No CDN or long cache header: these can
    be deleted at any time and must not linger in browser caches."""
    path = PERSONAL_PHOTOS_DIR / Path(name).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "no-store"})


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


def _save_personal_upload(upload: UploadFile) -> str:
    """Separate from _save_upload() (wardrobe items) -- this directory is
    gitignored and never committed, since these are face/body photos."""
    ext = Path(upload.filename or "upload.jpg").suffix or ".jpg"
    filename = f"{uuid4().hex}{ext}"
    dest = PERSONAL_PHOTOS_DIR / filename
    with dest.open("wb") as out:
        shutil.copyfileobj(upload.file, out)
    return f"data/personal_uploads/{filename}"


# --- AI budget guardrails -------------------------------------------------------
#
# Expensive endpoints meter themselves against per-day caps (UTC). Caps are
# env-overridable: USAGE_CAP_UPLOAD / USAGE_CAP_BUY / USAGE_CAP_GENERATE.

_DEFAULT_CAPS = {"upload": 80, "buy": 25, "generate": 40}


def _file_hash(path: str) -> str:
    import hashlib

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def _enforce_daily_cap(endpoint: str) -> None:
    cap = int(
        os.environ.get(f"USAGE_CAP_{endpoint.upper()}") or _DEFAULT_CAPS.get(endpoint, 50)
    )
    count = record_usage(endpoint)
    if count > cap:
        raise HTTPException(
            status_code=429,
            detail=(
                "Today's AI budget for this feature is used up "
                f"({cap} runs). Fresh budget tomorrow — your closet isn't going anywhere."
            ),
        )


def _tag_photo_cached(image_path: str) -> dict:
    """Tag a photo, but only pay the vision model once per identical file."""
    cached = get_cached_tags(_file_hash(image_path))
    if cached is not None:
        return cached
    tags = tag_photo(image_path).model_dump()
    save_tag_cache(_file_hash(image_path), tags)
    return tags


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


@app.get("/api/stats")
def api_stats() -> dict:
    """Aggregate wardrobe stats: total items, worn-this-month, streak, versatility."""
    from datetime import date
    from app.storage.db import get_wardrobe_cpw_stats, get_wardrobe_versatility

    items = list_items()
    this_month = date.today().strftime("%Y-%m")
    conn_stats = get_connection()
    try:
        rows = conn_stats.execute(
            "SELECT DISTINCT item_id FROM wear_log WHERE worn_on LIKE %s",
            (f"{this_month}%",),
        ).fetchall()
        worn_this_month = len(rows)
    finally:
        conn_stats.close()

    versatility = get_wardrobe_versatility()
    cpw = get_wardrobe_cpw_stats()
    return {
        "total_items": len(items),
        "worn_this_month": worn_this_month,
        "streak": get_current_streak(),
        "versatility_score": versatility["versatility_score"],
        "weekly_change": versatility["weekly_change"],
        "most_worn": versatility["most_worn"],
        "avg_cost_per_wear": cpw["avg_cost_per_wear"],
        "items_with_price": cpw["items_with_price"],
        "best_value_item_id": cpw["best_value_item_id"],
        "worst_value_item_id": cpw["worst_value_item_id"],
        "currency": cpw["currency"],
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
    worn = get_wear_counts().get(item_id, 0)
    row["worn"] = worn
    row["cost_per_wear"] = (
        round(row["price"] / worn, 2) if row.get("price") and worn > 0 else None
    )
    return item_to_dto(row)


class PriceRequest(BaseModel):
    price: float
    currency: str = "EUR"


@app.patch("/api/items/{item_id}/price")
def api_set_price(item_id: str, req: PriceRequest) -> dict:
    """Set or update the purchase price for a wardrobe item."""
    if get_item(item_id) is None:
        raise HTTPException(status_code=404, detail=f"No item with id {item_id}")
    if req.price < 0:
        raise HTTPException(status_code=400, detail="Price must be a positive number")
    set_item_price(item_id, req.price, req.currency)
    return {"status": "ok", "item_id": item_id, "price": req.price}


@app.get("/api/items/{item_id}/cpw")
def api_item_cpw(item_id: str) -> dict:
    """Cost-per-wear stats for one item."""
    if get_item(item_id) is None:
        raise HTTPException(status_code=404, detail=f"No item with id {item_id}")
    return get_item_cost_per_wear(item_id)


@app.delete("/api/items/{item_id}")
def api_delete_item(item_id: str) -> dict:
    if not delete_item(item_id):
        raise HTTPException(status_code=404, detail=f"No item with id {item_id}")
    return {"status": "deleted", "item_id": item_id}


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
        # Only a cache miss costs budget — repeat visits stay free.
        _enforce_daily_cap("generate")
        shortlist = retrieve_candidates(ctx)
        deck = generate_outfits(shortlist, ctx)
    counts = get_wear_counts()
    return {
        "context": req.model_dump(exclude_none=True),
        "outfits": [
            outfit_to_dto(outfit, i, counts) for i, outfit in enumerate(deck)
        ],
    }


@app.get("/api/outfits/saved")
def api_saved_outfits() -> dict:
    """Outfits the user has explicitly favorited (saved from the ideas/look
    pages), newest first — the durable favorites list."""
    outfits = get_saved_outfits()
    counts = get_wear_counts()
    return {
        "outfits": [
            outfit_to_dto(outfit, i, counts) for i, outfit in enumerate(outfits)
        ],
    }


@app.post("/api/outfits/{outfit_id}/save")
def api_save_outfit(outfit_id: str) -> dict:
    try:
        set_outfit_saved(outfit_id, True)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"outfit_id": outfit_id, "saved": True}


@app.delete("/api/outfits/{outfit_id}/save")
def api_unsave_outfit(outfit_id: str) -> dict:
    try:
        set_outfit_saved(outfit_id, False)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"outfit_id": outfit_id, "saved": False}


@app.get("/api/outfits/{outfit_id}")
def api_get_outfit(outfit_id: str) -> dict:
    outfit = get_generated_outfit(outfit_id)
    if outfit is None:
        raise HTTPException(status_code=404, detail=f"No outfit with id {outfit_id}")
    return outfit


@app.get("/api/planner/week")
def api_planner_week(
    start_date: str, end_date: str, x_device_id: str = Header(...)
) -> dict:
    """Weekly Planner: generated outfits for [start_date, end_date], one per
    day, resolved into the same DTO the deck endpoints return — plus this
    device's explicit day assignments (the '+' picks), keyed by ISO date."""
    rows = get_outfits_for_week(start_date, end_date)
    counts = get_wear_counts()
    outfits = []
    for idx, row in enumerate(rows):
        dto = outfit_to_dto(row, idx, counts)
        dto["date"] = str(row["day"])
        dto["rating"] = row.get("rating")
        outfits.append(dto)
    return {
        "outfits": outfits,
        "plans": get_planner_days(x_device_id, start_date, end_date),
    }


class PlannerDayRequest(BaseModel):
    day: str
    outfit_id: str


@app.put("/api/planner/day")
def api_set_planner_day(req: PlannerDayRequest, x_device_id: str = Header(...)) -> dict:
    """Persist a '+' pick so the plan survives refreshes and other devices."""
    if get_generated_outfit(req.outfit_id) is None:
        raise HTTPException(status_code=404, detail=f"No outfit with id {req.outfit_id}")
    set_planner_day(x_device_id, req.day, req.outfit_id)
    return {"status": "ok", "day": req.day, "outfit_id": req.outfit_id}


class QuizPreferenceRequest(BaseModel):
    formality: int
    pattern: str
    color_family: str


@app.post("/api/quiz/preference")
def api_quiz_preference(req: QuizPreferenceRequest):
    save_quiz_preference(req.formality, req.pattern, req.color_family)
    return {"status": "ok"}


@app.get("/api/quiz/wardrobe-dna")
def api_wardrobe_dna() -> dict:
    """Real-wardrobe breakdown used to personalize quiz questions and
    ground the final personality analysis in what the user actually owns."""
    return get_wardrobe_dna()


class QuizSubmission(BaseModel):
    answers: list[dict]  # [{question_id, chosen_option, formality, pattern, color_family, axis_signals}]


@app.post("/api/quiz/analyze")
def api_quiz_analyze(req: QuizSubmission) -> dict:
    """Combine quiz answers + wardrobe DNA into a named style personality
    with axis scores, strengths/gaps and 3 prioritized shopping
    recommendations."""
    dna = get_wardrobe_dna()
    result = analyze_quiz(req.answers, dna)
    # Persist preference signal (reuses existing table)
    for answer in req.answers:
        if answer.get("formality") and answer.get("pattern") and answer.get("color_family"):
            save_quiz_preference(answer["formality"], answer["pattern"], answer["color_family"])
    return result


class QuizResultRequest(BaseModel):
    personality_name: str
    result: dict


@app.post("/api/quiz/result")
def api_save_quiz_result(req: QuizResultRequest) -> dict:
    """Persist a completed personality result (drives the 30-day retake cadence)."""
    save_quiz_result(req.personality_name, req.result)
    return {"status": "ok"}


@app.get("/api/quiz/result")
def api_get_quiz_result() -> dict | None:
    """The most recent quiz result, or null if never taken."""
    return get_latest_quiz_result()


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


@app.get("/api/wear-log/suggest-today")
def api_suggest_today():
    result = suggest_todays_outfit()
    if result is None:
        return {"already_logged": False, "items": [], "confidence_label": None}
    return result


class QuickLogRequest(BaseModel):
    item_ids: list[str]
    rating: int = Field(ge=1, le=5)
    worn_on: str | None = None  # defaults to today


@app.post("/api/wear-log/quick-log")
def api_quick_log(
    req: QuickLogRequest, x_device_id: str = Header(...)
) -> dict:
    """
    Logs a worn outfit from the quick-log flow. Creates a new generated_outfit
    entry so the look has a stable ID and appears in the Planner, then logs
    it in wear_log with the given rating. rate_generated_outfit() handles both
    the rating update and the wear_log rows (re-logging here would double-count
    every item's wear frequency).
    """
    from datetime import date

    worn_on = req.worn_on or date.today().isoformat()

    # Validate all item_ids exist
    items = [get_item(i) for i in req.item_ids]
    missing = [req.item_ids[i] for i, item in enumerate(items) if item is None]
    if missing:
        raise HTTPException(400, f"Unknown item ids: {missing}")

    # Create a generated_outfit entry so it appears in the Planner
    outfit_id = save_generated_outfit(
        item_ids=req.item_ids,
        reasoning="Logged via quick-log",
        context={"source": "quick_log", "worn_on": worn_on},
    )

    # Rate it (also writes the wear_log rows for every item)
    rate_generated_outfit(outfit_id, req.rating, worn_on)

    # Automatically advance any active challenges for this device
    completed = advance_challenges_for_wear(x_device_id, req.item_ids)

    return {
        "outfit_id": outfit_id,
        "status": "logged",
        "challenges_completed": completed,
    }


@app.get("/api/challenges")
def api_get_challenges(x_device_id: str = Header(...)) -> list[dict]:
    """
    Active challenges, auto-generating new ones if fewer than 3 exist.
    The only challenges endpoint the frontend needs on load.
    """
    active = get_active_challenges(x_device_id)
    if len(active) < 3:
        needed = 3 - len(active)
        for c in generate_new_challenges(x_device_id)[:needed]:
            save_challenge(x_device_id, c)
        active = get_active_challenges(x_device_id)
    return active


@app.get("/api/challenges/completed")
def api_completed_challenges(x_device_id: str = Header(...)) -> list[dict]:
    """Recently completed challenges, newest first — the trophy case."""
    init_db()
    conn = get_connection()
    rows = conn.execute(
        """SELECT * FROM challenges
           WHERE device_id = %s AND status = 'completed'
           ORDER BY completed_at DESC LIMIT 10""",
        (x_device_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/wear-log/recent")
def api_wear_log_recent(limit: int = 10) -> dict:
    """Most recent rated outfits with their items' details, newest first."""
    return {"outfits": get_recent_rated_outfits(limit=min(limit, 50))}


@app.post("/api/items/upload")
async def api_upload_item(upload: UploadFile = File(...)) -> dict:
    """Tag an uploaded photo without saving it — the frontend review step.
    Identical re-uploads are served from the tag cache without a vision call;
    the daily cap is only consumed on a cache miss."""
    image_path = _save_upload(upload)
    cached = get_cached_tags(_file_hash(image_path))
    if cached is not None:
        return {"image_path": image_path, "tags": cached, "cached": True}
    _enforce_daily_cap("upload")
    item = tag_photo(image_path)
    save_tag_cache(_file_hash(image_path), item.model_dump())
    return {"image_path": image_path, "tags": item.model_dump()}


@app.post("/api/items")
def api_add_item(req: AddItemRequest) -> dict:
    """Save a reviewed, tagged item to the wardrobe (SQLite + Chroma)."""
    saved = ingest_item(req.image_path, req.tags.model_dump())
    if req.price is not None:
        set_item_price(saved["id"], req.price, req.currency)
    return item_to_dto(saved)


@app.post("/api/should-i-buy")
async def api_should_i_buy(
    upload: UploadFile = File(...),
    price: float | None = Form(None),
    currency: str = Form("EUR"),
) -> dict:
    """Run the shopping decision agent on a photo of a prospective purchase.
    An optional price turns on the cost-per-wear projection, benchmarked
    against the wardrobe's real average CPW when any prices are set."""
    image_path = _save_upload(upload)

    # The agent always runs its LLM loop, so the buy budget is spent here.
    _enforce_daily_cap("buy")

    price_context = ""
    if price:
        cpw_stats = get_wardrobe_cpw_stats()
        price_context = (
            f"\nThe user is considering paying {currency}{price} for this item."
        )
        if cpw_stats["avg_cost_per_wear"]:
            price_context += (
                f" Their current wardrobe average is "
                f"{cpw_stats['currency']}{cpw_stats['avg_cost_per_wear']} per wear."
            )

    verdict, tool_log = evaluate_purchase(image_path, verbose=False, extra_context=price_context)

    # Reuse the tag the agent already computed (tag_new_item is a required
    # step) instead of paying for a second vision pass. Only fall back to a
    # direct call — or the identical-photo cache — when it somehow didn't run.
    new_item = next(
        (
            t["result"]
            for t in reversed(tool_log)
            if t["name"] == "tag_new_item"
            and isinstance(t.get("result"), dict)
            and "error" not in t["result"]
        ),
        None,
    )
    if new_item is None:
        new_item = _tag_photo_cached(image_path)
    else:
        save_tag_cache(_file_hash(image_path), new_item)

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
    image_path = _save_personal_upload(photo)  # private, under data/personal_uploads/
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
