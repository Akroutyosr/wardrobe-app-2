"""
Postgres (Supabase) storage for structured wardrobe item fields, replacing
the SQLite layer. The embeddings live in the same database's items.embedding
column (pgvector), so there's one system of record instead of two in sync.

The connection string comes from the DATABASE_URL environment variable
(see backend/.env) — a managed connection string that also keeps the backend
deployment-host-agnostic. Copy backend/.env.example to backend/.env and set it,
then run the one-time migration:

    python -m app.scripts.migrate_to_postgres

Usage from the backend/ directory:
    uvicorn app.main:app --reload --port 8000
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv()

# Embeds the wardrobe items (Parent-child to the API items shape).
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 (Chroma default embedding function)

# Explicit column list (NOT `*`) so the heavy embeddings column is excluded
# from API-facing reads by default.
ITEM_COLUMNS = (
    "id, image_path, category, subcategory, primary_color, secondary_color, "
    "pattern, formality, seasons, fabric_guess, notes, brand, price, "
    "currency, purchase_date, cutout_path, created_at"
)

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    image_path TEXT,
    category TEXT,
    subcategory TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    pattern TEXT,
    formality INTEGER,
    seasons TEXT,            -- JSON array as text
    fabric_guess TEXT,
    notes TEXT,
    brand TEXT,
    price DOUBLE PRECISION,
    purchase_date TEXT,
    cutout_path TEXT,
    created_at TEXT,
    embedding vector(384)
);

-- Hard guard against unwitting duplicate ingestion: each photo may be the
-- row for at most one item.
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_image_path ON items(image_path);

-- Similarity search index (L2). A brute-force scan is fine at this size,
-- so add an HNSW index if the wardrobe grows large.
CREATE INDEX IF NOT EXISTS idx_items_embedding ON items USING hnsw (embedding vector_l2_ops);

CREATE TABLE IF NOT EXISTS wear_log (
    id SERIAL PRIMARY KEY,
    item_id TEXT REFERENCES items(id),
    worn_on TEXT,
    outfit_id TEXT,
    rating INTEGER
);

-- Outfits are persisted the moment they're generated so they have a stable
-- id for deep-linking (e.g. /look/<id>) even before anyone rates them.
-- Rating later reuses the SAME id, so 'shown' and 'rated' share an identity.
CREATE TABLE IF NOT EXISTS generated_outfits (
    id TEXT PRIMARY KEY,
    context_json TEXT,
    item_ids_json TEXT,
    reasoning TEXT,
    created_at TEXT,
    rating INTEGER,
    worn_on TEXT,
    is_saved BOOLEAN DEFAULT FALSE
);

-- Style quiz answers: a cold-start signal for the stylist before real
-- wear_log feedback accumulates. Every swipe appends one row.
CREATE TABLE IF NOT EXISTS style_preferences (
    id SERIAL PRIMARY KEY,
    formality INTEGER,
    pattern TEXT,
    color_family TEXT,
    created_at TEXT
);

-- Fitting room: an optional full-body reference photo the user opts into
-- saving so they don't re-upload it every time they try something on.
-- Privacy is opt-in (consented_to_save) and always deletable per device.
CREATE TABLE IF NOT EXISTS fitting_room_photos (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    image_path TEXT NOT NULL,
    consented_to_save BOOLEAN DEFAULT FALSE,
    created_at TEXT
);

-- A try-on run: composes one garment at a time onto the base photo, so
-- session state lets the frontend show real progress (current_step/total)
-- during the slow multi-pass model calls instead of a bare spinner.
CREATE TABLE IF NOT EXISTS tryon_sessions (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    base_photo_path TEXT NOT NULL,
    outfit_id TEXT REFERENCES generated_outfits(id),
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER,
    result_image_path TEXT,
    status TEXT DEFAULT 'in_progress',
    created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_fitting_device ON fitting_room_photos(device_id);

-- The latest completed quiz result: named personality + axis scores + the
-- shopping recommendations, plus when it was taken so the frontend can drive
-- the 30-day retake cadence. One roll per quiz run (append-only history).
CREATE TABLE IF NOT EXISTS quiz_results (
    id SERIAL PRIMARY KEY,
    personality_name TEXT,
    result_json TEXT,
    taken_at TEXT
);
"""


REPO_ROOT = Path(__file__).resolve().parents[2]  # backend/
CUTOUT_DIR = REPO_ROOT / "data" / "cutouts"

_cutout_session = None


def _get_cutout_session():
    """Lazy rembg session (loaded once, reused across all cutouts). Uses the
    lite u2netp model by default -- small and fast, good enough for clothing
    cutouts. Set U2NET_MODEL=u2net for the sharper full model."""
    global _cutout_session
    if _cutout_session is None:
        from rembg.session_factory import new_session

        _cutout_session = new_session(os.environ.get("U2NET_MODEL", "u2netp"))
    return _cutout_session


def generate_cutout(image_path: str) -> str:
    """One-time background removal for an item photo, cached to disk so it is
    never re-run on every render. Returns the stored relative cutout path."""
    from PIL import Image
    from rembg import remove

    src = Path(image_path)
    if not src.is_absolute():
        src = REPO_ROOT / src
    if not src.is_file():
        # Stored paths may be absolute on a different host (Render vs local) --
        # fall back to the canonical photos dir by basename.
        src = REPO_ROOT / "data" / "photos" / Path(image_path).name
    if not src.is_file():
        raise FileNotFoundError(f"source photo missing: {src}")

    cutout_filename = f"cutout_{src.stem}.png"
    dest = CUTOUT_DIR / cutout_filename
    if dest.is_file():
        return f"data/cutouts/{cutout_filename}"

    CUTOUT_DIR.mkdir(parents=True, exist_ok=True)
    output = remove(Image.open(src), session=_get_cutout_session())
    # The plate shows items at ~200px, so keep full-res cutouts off disk/repo:
    # downscale to a sane max dimension and save optimized.
    if max(output.size) > 1000:
        output.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
    output.save(dest, optimize=True)
    return f"data/cutouts/{cutout_filename}"


def set_item_cutout(item_id: str, cutout_path: str) -> None:
    init_db()
    conn = get_connection()
    conn.execute("UPDATE items SET cutout_path = %s WHERE id = %s", (cutout_path, item_id))
    conn.commit()
    conn.close()


# --- Fitting room -------------------------------------------------------------


def save_fitting_photo(device_id: str, image_path: str, consented: bool) -> str:
    init_db()
    photo_id = str(uuid.uuid4())[:8]
    conn = get_connection()
    conn.execute(
        "INSERT INTO fitting_room_photos (id, device_id, image_path, consented_to_save, created_at) "
        "VALUES (%s, %s, %s, %s, %s)",
        (photo_id, device_id, image_path, consented, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()
    return photo_id


def get_saved_fitting_photo(device_id: str) -> dict | None:
    init_db()
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM fitting_room_photos WHERE device_id = %s AND consented_to_save = TRUE "
        "ORDER BY created_at DESC LIMIT 1",
        (device_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_fitting_photo(device_id: str) -> None:
    init_db()
    conn = get_connection()
    conn.execute("DELETE FROM fitting_room_photos WHERE device_id = %s", (device_id,))
    conn.commit()
    conn.close()


def create_tryon_session(device_id: str, base_photo_path: str, outfit_id: str, total_steps: int) -> str:
    init_db()
    session_id = str(uuid.uuid4())[:8]
    conn = get_connection()
    conn.execute(
        """INSERT INTO tryon_sessions (id, device_id, base_photo_path, outfit_id, total_steps, status, created_at)
        VALUES (%s, %s, %s, %s, %s, 'in_progress', %s)""",
        (session_id, device_id, base_photo_path, outfit_id, total_steps, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()
    return session_id


def update_tryon_session(session_id: str, step: int, result_image_path: str, status: str) -> None:
    init_db()
    conn = get_connection()
    conn.execute(
        "UPDATE tryon_sessions SET current_step=%s, result_image_path=%s, status=%s WHERE id=%s",
        (step, result_image_path, status, session_id),
    )
    conn.commit()
    conn.close()


def get_tryon_session(session_id: str) -> dict | None:
    init_db()
    conn = get_connection()
    row = conn.execute("SELECT * FROM tryon_sessions WHERE id = %s", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def _conninfo() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Create a Supabase project, grab the "
            "connection string, and add it to backend/.env "
            "(copy backend/.env.example → backend/.env). Then run "
            "`python -m app.scripts.migrate_to_postgres` once."
        )
    if "sslmode" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


def get_connection():
    """Open a new Postgres connection with dict-style rows."""
    return psycopg.connect(
        _conninfo(),
        row_factory=psycopg.rows.dict_row,
        connect_timeout=int(os.environ.get("DB_CONNECT_TIMEOUT", "8")),
    )


_schema_initialized = False


def init_db() -> None:
    """Ensure tables exist. Runs the full SCHEMA only once per process -- the
    previous version re-executed it on every single query, which added many
    slow round-trips to an already flaky connection. (Deploys restart the
    process, so live migrations still apply on boot.)"""
    global _schema_initialized
    if _schema_initialized:
        return
    conn = get_connection()
    try:
        for statement in (s.strip() for s in SCHEMA.split(";") if s.strip()):
            conn.execute(statement)
        # CREATE TABLE IF NOT EXISTS won't add a column to an already-existing
        # items table, so migrate live tables explicitly (Postgres supports this).
        conn.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS cutout_path TEXT")
        conn.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR'")
        conn.execute("ALTER TABLE generated_outfits ADD COLUMN IF NOT EXISTS is_saved BOOLEAN DEFAULT FALSE")
        conn.commit()
    finally:
        conn.close()
    _schema_initialized = True


def _parse(item: dict) -> dict:
    """Parse stored text columns into their real types."""
    item["seasons"] = json.loads(item["seasons"] or "[]")
    return item


def add_item(image_path: str, tags: dict) -> dict:
    init_db()
    created_at = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    existing = conn.execute(
        "SELECT id, created_at FROM items WHERE image_path = %s", (image_path,)
    ).fetchone()

    if existing:
        # Photo already in the wardrobe: update the row in place instead of
        # inserting a duplicate. Keeps the original created_at so re-tagging
        # the same photo reads as an edit, not a new item.
        item_id = existing["id"]
        created_at = existing["created_at"]
        conn.execute(
            """UPDATE items SET category=%s, subcategory=%s, primary_color=%s,
            secondary_color=%s, pattern=%s, formality=%s, seasons=%s,
            fabric_guess=%s, notes=%s WHERE id=%s""",
            (
                tags.get("category"), tags.get("subcategory"), tags.get("primary_color"),
                tags.get("secondary_color"), tags.get("pattern"), tags.get("formality"),
                json.dumps(tags.get("seasons", [])), tags.get("fabric_guess"), tags.get("notes"),
                item_id,
            ),
        )
    else:
        item_id = str(uuid.uuid4())[:8]
        conn.execute(
            """INSERT INTO items
            (id, image_path, category, subcategory, primary_color, secondary_color,
             pattern, formality, seasons, fabric_guess, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                item_id, image_path, tags.get("category"), tags.get("subcategory"),
                tags.get("primary_color"), tags.get("secondary_color"), tags.get("pattern"),
                tags.get("formality"), json.dumps(tags.get("seasons", [])),
                tags.get("fabric_guess"), tags.get("notes"), created_at,
            ),
        )

    conn.commit()
    conn.close()

    return {"id": item_id, "image_path": image_path, "created_at": created_at, **tags}


def delete_item(item_id: str) -> bool:
    """Remove an item and its wear-log rows. Generated outfits and try-on
    sessions are left untouched (stale references are skipped at read time),
    so deep links don't break when a piece is deleted. Returns False if no
    such item exists."""
    init_db()
    conn = get_connection()
    try:
        row = conn.execute("SELECT id FROM items WHERE id = %s", (item_id,)).fetchone()
        if row is None:
            return False
        conn.execute("DELETE FROM wear_log WHERE item_id = %s", (item_id,))
        conn.execute("DELETE FROM items WHERE id = %s", (item_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def get_wear_counts() -> dict[str, int]:
    """Returns {item_id: number_of_times_worn} across the whole wear log."""
    init_db()
    conn = get_connection()
    rows = conn.execute(
        "SELECT item_id, COUNT(*) AS n FROM wear_log GROUP BY item_id"
    ).fetchall()
    counts = {row["item_id"]: row["n"] for row in rows}
    conn.close()
    return counts


def get_current_streak() -> int:
    """
    Counts consecutive days ending today (UTC) where at least one
    outfit was worn (has a row in wear_log with a non-null worn_on).
    Returns 0 if nothing has been logged.
    """
    init_db()
    conn = get_connection()
    rows = conn.execute(
        """SELECT DISTINCT worn_on::date AS day
           FROM wear_log
           WHERE worn_on IS NOT NULL
           ORDER BY day DESC"""
    ).fetchall()
    conn.close()

    if not rows:
        return 0

    from datetime import date, timedelta
    today = date.today()
    streak = 0
    expected = today

    for row in rows:
        day = row["day"] if isinstance(row["day"], date) else date.fromisoformat(str(row["day"]))
        if day == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif day < expected:
            break

    return streak


def get_wardrobe_versatility() -> dict:
    """
    Computes a real versatility score:
    - total_combinations: count of item pairs that are formality-compatible
      and category-complementary (could theoretically be worn together)
    - weekly_change: how many outfits were rated in the last 7 days
    - most_worn: top 5 items by wear_log frequency
    """
    init_db()
    conn = get_connection()
    items = [dict(r) for r in conn.execute("SELECT id, category, formality FROM items").fetchall()]

    COMPLEMENTARY = {
        "top": {"bottom", "shoes", "outerwear", "accessory"},
        "bottom": {"top", "shoes", "outerwear", "accessory"},
        "dress": {"shoes", "outerwear", "accessory"},
        "outerwear": {"top", "bottom", "dress", "shoes", "accessory"},
        "shoes": {"top", "bottom", "dress", "outerwear", "accessory"},
        "accessory": {"top", "bottom", "dress", "outerwear", "shoes"},
    }

    combinations = 0
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            a, b = items[i], items[j]
            if (
                abs((a["formality"] or 3) - (b["formality"] or 3)) <= 1
                and b["category"] in COMPLEMENTARY.get(a["category"], set())
            ):
                combinations += 1

    from datetime import date, timedelta
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    new_this_week = conn.execute(
        "SELECT COUNT(DISTINCT outfit_id) AS n FROM wear_log WHERE worn_on >= %s",
        (week_ago,),
    ).fetchone()["n"]

    top_rows = conn.execute(
        """SELECT i.id, i.subcategory, i.primary_color, i.category,
                  COUNT(wl.id) as wear_count
           FROM items i
           JOIN wear_log wl ON wl.item_id = i.id
           GROUP BY i.id, i.subcategory, i.primary_color, i.category
           ORDER BY wear_count DESC
           LIMIT 5"""
    ).fetchall()
    conn.close()

    return {
        "versatility_score": combinations,
        "weekly_change": new_this_week,
        "most_worn": [dict(r) for r in top_rows],
    }


def get_distinct_colors() -> list[str]:
    """Raw distinct primary/secondary color values across the wardrobe."""
    init_db()
    conn = get_connection()
    rows = conn.execute(
        "SELECT DISTINCT primary_color AS color FROM items WHERE primary_color IS NOT NULL "
        "UNION SELECT DISTINCT secondary_color FROM items WHERE secondary_color IS NOT NULL"
    ).fetchall()
    conn.close()
    return sorted({row["color"] for row in rows if row["color"]})


def get_item(item_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        f"SELECT {ITEM_COLUMNS} FROM items WHERE id = %s", (item_id,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return _parse(dict(row))


def set_item_price(item_id: str, price: float, currency: str = "EUR") -> None:
    """Sets or updates the purchase price for a wardrobe item."""
    init_db()
    conn = get_connection()
    conn.execute(
        "UPDATE items SET price = %s, currency = %s WHERE id = %s",
        (price, currency, item_id),
    )
    conn.commit()
    conn.close()


def get_item_cost_per_wear(item_id: str) -> dict:
    """
    Returns wear count, price, and cost-per-wear for one item.
    cost_per_wear is None if no price is set or item has never been worn.
    """
    init_db()
    conn = get_connection()
    item = conn.execute(
        "SELECT id, price, currency FROM items WHERE id = %s", (item_id,)
    ).fetchone()
    wear_row = conn.execute(
        "SELECT COUNT(*) AS cnt FROM wear_log WHERE item_id = %s", (item_id,)
    ).fetchone()
    conn.close()

    if item is None:
        return {"wear_count": 0, "cost_per_wear": None, "price": None}

    wear_count = wear_row["cnt"] if wear_row else 0
    price = item["price"]
    currency = item["currency"] or "EUR"

    cost_per_wear = None
    if price and wear_count > 0:
        cost_per_wear = round(price / wear_count, 2)

    return {
        "item_id": item_id,
        "wear_count": wear_count,
        "price": price,
        "currency": currency,
        "cost_per_wear": cost_per_wear,
    }


def get_wardrobe_cpw_stats() -> dict:
    """
    Wardrobe-wide CPW stats for the home screen and shopping agent context.
    Only includes items that have both a price and at least one wear logged.
    Single joined query -- one connection for the whole computation instead of
    one per priced item.
    """
    init_db()
    conn = get_connection()
    rows = conn.execute(
        """SELECT i.id, i.price, i.currency,
                  COALESCE(w.cnt, 0) AS wear_count
           FROM items i
           LEFT JOIN (
               SELECT item_id, COUNT(*) AS cnt FROM wear_log GROUP BY item_id
           ) w ON w.item_id = i.id
           WHERE i.price IS NOT NULL"""
    ).fetchall()
    conn.close()

    cpw_values = []
    best = {"item_id": None, "cost_per_wear": float("inf")}
    worst = {"item_id": None, "cost_per_wear": 0}
    currency = rows[0]["currency"] or "EUR" if rows else "EUR"

    for row in rows:
        wear_count = row["wear_count"]
        if not row["price"] or wear_count <= 0:
            continue
        cpw = round(row["price"] / wear_count, 2)
        cpw_values.append(cpw)
        if cpw < best["cost_per_wear"]:
            best = {"item_id": row["id"], "cost_per_wear": cpw}
        if cpw > worst["cost_per_wear"]:
            worst = {"item_id": row["id"], "cost_per_wear": cpw}

    if not cpw_values:
        return {
            "avg_cost_per_wear": None,
            "items_with_price": 0,
            "best_value_item_id": None,
            "worst_value_item_id": None,
            "currency": currency,
        }

    return {
        "avg_cost_per_wear": round(sum(cpw_values) / len(cpw_values), 2),
        "items_with_price": len(cpw_values),
        "best_value_item_id": best["item_id"],
        "worst_value_item_id": worst["item_id"],
        "currency": currency,
    }


def list_items(category: str | None = None, season: str | None = None) -> list[dict]:
    init_db()
    conn = get_connection()
    query = f"SELECT {ITEM_COLUMNS} FROM items WHERE 1=1"
    params = []
    if category:
        query += " AND category = %s"
        params.append(category)
    if season:
        query += " AND seasons LIKE %s"
        params.append(f'%"{season}"%')

    rows = conn.execute(query, params).fetchall()
    conn.close()

    return [_parse(dict(row)) for row in rows]


def log_outfit_wear(
    item_ids: list[str], rating: int, worn_on: str | None = None, outfit_id: str | None = None
) -> str:
    """
    Logs that an outfit (a set of item ids) was worn, with a 1-5 rating.
    Returns the outfit_id shared across all the item rows for this wear.
    Pass outfit_id to reuse a persisted generated_outfits id so the 'shown'
    and 'rated/worn' states share one identity.
    """
    init_db()
    outfit_id = outfit_id or str(uuid.uuid4())[:8]
    worn_on = worn_on or datetime.now(timezone.utc).date().isoformat()

    conn = get_connection()
    for item_id in item_ids:
        conn.execute(
            "INSERT INTO wear_log (item_id, worn_on, outfit_id, rating) VALUES (%s, %s, %s, %s)",
            (item_id, worn_on, outfit_id, rating),
        )
    conn.commit()
    conn.close()
    return outfit_id


def get_recent_rated_outfits(limit: int = 5) -> list[dict]:
    """
    Returns the most recent rated outfits, each with its items' details,
    most recent first. Used to build few-shot preference examples for the
    outfit generation prompt.
    """
    init_db()
    conn = get_connection()
    outfit_rows = conn.execute(
        """SELECT DISTINCT outfit_id, worn_on, rating FROM wear_log
        ORDER BY worn_on DESC LIMIT %s""",
        (limit,),
    ).fetchall()

    results = []
    for row in outfit_rows:
        qualified = "i." + ITEM_COLUMNS.replace(", ", ", i.")
        item_rows = conn.execute(
            f"""SELECT {qualified} FROM items i
            JOIN wear_log w ON i.id = w.item_id
            WHERE w.outfit_id = %s""",
            (row["outfit_id"],),
        ).fetchall()
        results.append({
            "outfit_id": row["outfit_id"],
            "worn_on": row["worn_on"],
            "rating": row["rating"],
            "items": [_parse(dict(item_row)) for item_row in item_rows],
        })

    conn.close()
    return results


def suggest_todays_outfit() -> dict | None:
    """
    Returns the most likely outfit for today based on historical
    day-of-week patterns in wear_log. Returns None if no history exists.
    Only looks at items that have been worn on the same day of week before.
    """
    init_db()
    from datetime import date
    today = date.today()
    day_name = today.strftime("%A")  # "Monday", "Tuesday", etc.

    conn = get_connection()

    # Check if today already has a logged outfit -- if so, return it
    today_str = today.isoformat()
    existing = conn.execute(
        """SELECT DISTINCT outfit_id FROM wear_log
           WHERE worn_on IS NOT NULL AND worn_on::date::text = %s LIMIT 1""",
        (today_str,),
    ).fetchone()

    if existing:
        outfit_id = existing["outfit_id"]
        qualified = "i." + ITEM_COLUMNS.replace(", ", ", i.")
        items_rows = conn.execute(
            f"""SELECT {qualified} FROM items i
               JOIN wear_log wl ON wl.item_id = i.id
               WHERE wl.outfit_id = %s""",
            (outfit_id,),
        ).fetchall()
        conn.close()
        return {
            "already_logged": True,
            "outfit_id": outfit_id,
            "items": [_parse(dict(r)) for r in items_rows],
        }

    # Find most-worn items on the same day of week historically
    rows = conn.execute(
        """SELECT item_id, COUNT(*) as freq
           FROM wear_log
           WHERE worn_on IS NOT NULL AND TRIM(TO_CHAR(worn_on::date, 'Day')) = %s
           GROUP BY item_id
           ORDER BY freq DESC
           LIMIT 12""",
        (day_name,),
    ).fetchall()
    conn.close()

    if not rows:
        return None

    item_ids = [r["item_id"] for r in rows]
    items = [get_item(i) for i in item_ids]
    items = [i for i in items if i is not None]

    # Pick one per category to assemble a plausible outfit
    by_category = {}
    for item in items:
        cat = item["category"]
        if cat not in by_category:
            by_category[cat] = item

    suggested = list(by_category.values())
    if not suggested:
        return None

    return {
        "already_logged": False,
        "items": suggested,
        "confidence_label": f"based on your typical {day_name} outfits",
    }


def save_generated_outfit(item_ids: list[str], reasoning: str, context: dict) -> str:
    """Persists a generated outfit immediately at creation time -- this is
    what gives it a stable id for deep-linking, before anyone rates it."""
    init_db()
    outfit_id = str(uuid.uuid4())[:8]
    created_at = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    conn.execute(
        """INSERT INTO generated_outfits
        (id, context_json, item_ids_json, reasoning, created_at, rating, worn_on)
        VALUES (%s, %s, %s, %s, %s, NULL, NULL)""",
        (outfit_id, json.dumps(context), json.dumps(item_ids), reasoning, created_at),
    )
    conn.commit()
    conn.close()
    return outfit_id


def get_generated_outfit(outfit_id: str) -> dict | None:
    init_db()
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM generated_outfits WHERE id = %s", (outfit_id,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    result = dict(row)
    result["item_ids"] = json.loads(result["item_ids_json"])
    result["context"] = json.loads(result["context_json"]) if result["context_json"] else {}
    return result


def rate_generated_outfit(outfit_id: str, rating: int, worn_on: str | None = None) -> None:
    """Rates a previously-generated outfit, reusing the same id in wear_log so
    'shown' and 'rated/worn' states share one identity."""
    init_db()
    worn_on = worn_on or datetime.now(timezone.utc).date().isoformat()
    conn = get_connection()
    conn.execute(
        "UPDATE generated_outfits SET rating = %s, worn_on = %s WHERE id = %s",
        (rating, worn_on, outfit_id),
    )
    conn.commit()
    row = conn.execute(
        "SELECT item_ids_json FROM generated_outfits WHERE id = %s", (outfit_id,)
    ).fetchone()
    conn.close()
    if row is None:
        raise ValueError(f"No generated outfit with id {outfit_id}")
    item_ids = json.loads(row["item_ids_json"])
    log_outfit_wear(item_ids, rating, worn_on, outfit_id=outfit_id)


def set_outfit_saved(outfit_id: str, saved: bool) -> None:
    """Mark a generated outfit as saved (favorite) or unsave it. Idempotent."""
    init_db()
    conn = get_connection()
    row = conn.execute(
        "UPDATE generated_outfits SET is_saved = %s WHERE id = %s RETURNING id",
        (saved, outfit_id),
    ).fetchone()
    conn.commit()
    conn.close()
    if row is None:
        raise ValueError(f"No generated outfit with id {outfit_id}")


def get_saved_outfits() -> list[dict]:
    """All outfits the user has explicitly saved (favorited), newest first."""
    init_db()
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM generated_outfits WHERE is_saved = TRUE ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_recent_outfit_deck(
    context: dict, max_age_seconds: int = 6 * 60 * 60, limit: int = 4
) -> list[dict]:
    """LLM deck cache: returns the most recent batch of unrated generated outfits
    for this exact context, so repeat /api/outfits/generate calls (e.g. the home
    page) skip the slow Gemini round-trip. Empty list if none is fresh enough.

    Defaults to a 6-hour window: the weather context is bucketed (see
    weatherNotes on the frontend), so the key only changes on real condition
    shifts — a longer TTL means refreshes all day hit the cache instead of
    re-running Gemini every few minutes."""
    init_db()
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT id, item_ids_json, reasoning, created_at
               FROM generated_outfits
               WHERE context_json::jsonb = %s::jsonb
                 AND rating IS NULL
                 AND (created_at::timestamptz) > now() - make_interval(secs => %s)
               ORDER BY created_at DESC
               LIMIT %s""",
            (json.dumps(context, sort_keys=True), max_age_seconds, limit * 2),
        ).fetchall()
    finally:
        conn.close()

    if not rows:
        return []
    # The persistence writes a whole deck in one call, so every outfit in a batch
    # shares the same created_at — take only that newest cohort.
    newest = rows[0]["created_at"]
    batch = [r for r in rows if r["created_at"] == newest]
    return [
        {
            "id": r["id"],
            "item_ids": json.loads(r["item_ids_json"]),
            "reasoning": r["reasoning"],
        }
        for r in batch[:limit]
    ]


def get_outfits_for_week(start_date: str, end_date: str) -> list[dict]:
    """Generated outfits whose wear day (worn_on if rated, else created_at)
    falls within [start_date, end_date], returning at most one per day (the
    most recently created) for the planner's day grid. YYYY-MM-DD strings."""
    init_db()
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT DISTINCT ON (COALESCE(worn_on, created_at)::date)
                      id, item_ids_json, reasoning, rating, worn_on, created_at,
                      COALESCE(worn_on, created_at)::date AS day
               FROM generated_outfits
               WHERE COALESCE(worn_on, created_at)::date BETWEEN %s::date AND %s::date
               ORDER BY COALESCE(worn_on, created_at)::date, created_at DESC""",
            (start_date, end_date),
        ).fetchall()
    finally:
        conn.close()

    results = []
    for row in rows:
        item = dict(row)
        raw = item["item_ids_json"]
        item["item_ids"] = json.loads(raw) if isinstance(raw, str) else raw
        results.append(item)
    return results


def save_quiz_preference(formality: int, pattern: str, color_family: str) -> None:
    init_db()
    conn = get_connection()
    conn.execute(
        "INSERT INTO style_preferences (formality, pattern, color_family, created_at) VALUES (%s, %s, %s, %s)",
        (formality, pattern, color_family, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


def get_style_preference_summary() -> dict | None:
    """Cold-start signal only -- meant to be used when real wear_log
    history is sparse/empty, not to override real feedback once it exists."""
    init_db()
    conn = get_connection()
    rows = conn.execute(
        "SELECT formality, pattern, color_family FROM style_preferences"
    ).fetchall()
    conn.close()
    if not rows:
        return None

    from collections import Counter

    formalities = [r["formality"] for r in rows]
    patterns = [r["pattern"] for r in rows]
    colors = [r["color_family"] for r in rows]
    return {
        "avg_formality": round(sum(formalities) / len(formalities), 1),
        "preferred_pattern": Counter(patterns).most_common(1)[0][0],
        "preferred_color_family": Counter(colors).most_common(1)[0][0],
    }


def get_wardrobe_dna(device_id: str | None = None) -> dict:
    """Analyzes the real wardrobe to produce a DNA breakdown
    used both for personalizing quiz questions and generating the final result.

    `device_id` is accepted for signature symmetry with other per-device
    storage calls, but items are shared across the app (no per-device column),
    so the analysis always reflects the whole wardrobe.
    """
    init_db()
    conn = get_connection()
    items = [dict(r) for r in conn.execute("SELECT * FROM items").fetchall()]
    conn.close()

    from collections import Counter
    import json

    categories = Counter(i["category"] for i in items)
    colors = Counter(i["primary_color"] for i in items)
    patterns = Counter(i["pattern"] for i in items)
    formalities = [i["formality"] for i in items if i["formality"]]
    seasons_flat = []
    for i in items:
        try:
            seasons_flat.extend(json.loads(i["seasons"] or "[]"))
        except Exception:
            pass
    seasons = Counter(seasons_flat)

    avg_formality = round(sum(formalities) / len(formalities), 1) if formalities else 3
    top_colors = [c for c, _ in colors.most_common(5)]
    missing_categories = [
        c
        for c in ["top", "bottom", "outerwear", "shoes", "accessory", "dress"]
        if categories.get(c, 0) == 0
    ]
    underrepresented = [c for c, n in categories.items() if n == 1]

    return {
        "total_items": len(items),
        "category_breakdown": dict(categories),
        "top_colors": top_colors,
        "pattern_breakdown": dict(patterns),
        "avg_formality": avg_formality,
        "season_breakdown": dict(seasons),
        "missing_categories": missing_categories,
        "underrepresented_categories": underrepresented,
        "color_diversity": len(colors),
    }


def save_quiz_result(personality_name: str, result: dict) -> None:
    """Append one completed quiz result (used by the retake mechanic)."""
    init_db()
    conn = get_connection()
    conn.execute(
        "INSERT INTO quiz_results (personality_name, result_json, taken_at) VALUES (%s, %s, %s)",
        (personality_name, json.dumps(result), datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


def get_latest_quiz_result() -> dict | None:
    """The most recent quiz result, or None if the quiz has never been taken."""
    init_db()
    conn = get_connection()
    row = conn.execute(
        "SELECT personality_name, result_json, taken_at FROM quiz_results"
        " ORDER BY taken_at DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if not row:
        return None
    try:
        result = json.loads(row["result_json"])
    except Exception:
        result = {}
    return {**result, "personality_name": row["personality_name"], "taken_at": row["taken_at"]}