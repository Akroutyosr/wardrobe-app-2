"""
SQLite storage for structured wardrobe item fields. Replaces the flat
wardrobe.json from Phase 1 now that the tagging pipeline is trustworthy.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]  # backend/
DB_PATH = REPO_ROOT / "data" / "wardrobe.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    image_path TEXT,
    category TEXT,
    subcategory TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    pattern TEXT,
    formality INTEGER,
    seasons TEXT,        -- JSON array as text
    fabric_guess TEXT,
    notes TEXT,
    brand TEXT,
    price REAL,
    purchase_date TEXT,
    created_at TEXT
);

-- Hard guard against unwitting duplicate ingestion: each photo may be the
-- row for at most one item. Applied automatically by init_db() on the next
-- run; existing data is already deduped so nothing conflicts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_image_path ON items(image_path);

CREATE TABLE IF NOT EXISTS wear_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT REFERENCES items(id),
    worn_on TEXT,
    outfit_id TEXT,
    rating INTEGER
);
"""


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def add_item(image_path: str, tags: dict) -> dict:
    init_db()
    created_at = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    existing = conn.execute(
        "SELECT id, created_at FROM items WHERE image_path = ?", (image_path,)
    ).fetchone()

    if existing:
        # Photo already in the wardrobe: update the row in place instead of
        # inserting a duplicate. Keeps the original created_at so re-tagging
        # the same photo reads as an edit, not a new item.
        item_id = existing["id"]
        created_at = existing["created_at"]
        conn.execute(
            """UPDATE items SET category=?, subcategory=?, primary_color=?, secondary_color=?,
            pattern=?, formality=?, seasons=?, fabric_guess=?, notes=? WHERE id=?""",
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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


def get_item(item_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    if row is None:
        return None
    result = dict(row)
    result["seasons"] = json.loads(result["seasons"] or "[]")
    return result


def list_items(category: str | None = None, season: str | None = None) -> list[dict]:
    init_db()
    conn = get_connection()
    query = "SELECT * FROM items WHERE 1=1"
    params = []
    if category:
        query += " AND category = ?"
        params.append(category)
    if season:
        query += " AND seasons LIKE ?"
        params.append(f'%"{season}"%')

    rows = conn.execute(query, params).fetchall()
    conn.close()

    results = []
    for row in rows:
        item = dict(row)
        item["seasons"] = json.loads(item["seasons"] or "[]")
        results.append(item)
    return results


def log_outfit_wear(item_ids: list[str], rating: int, worn_on: str | None = None) -> str:
    """
    Logs that an outfit (a set of item ids) was worn, with a 1-5 rating.
    Returns the outfit_id shared across all the item rows for this wear.
    """
    init_db()
    outfit_id = str(uuid.uuid4())[:8]
    worn_on = worn_on or datetime.now(timezone.utc).date().isoformat()

    conn = get_connection()
    for item_id in item_ids:
        conn.execute(
            "INSERT INTO wear_log (item_id, worn_on, outfit_id, rating) VALUES (?, ?, ?, ?)",
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
        ORDER BY worn_on DESC LIMIT ?""",
        (limit,),
    ).fetchall()

    results = []
    for row in outfit_rows:
        item_rows = conn.execute(
            """SELECT items.* FROM items
            JOIN wear_log ON items.id = wear_log.item_id
            WHERE wear_log.outfit_id = ?""",
            (row["outfit_id"],),
        ).fetchall()
        items = []
        for item_row in item_rows:
            item = dict(item_row)
            item["seasons"] = json.loads(item["seasons"] or "[]")
            items.append(item)

        results.append({
            "outfit_id": row["outfit_id"],
            "worn_on": row["worn_on"],
            "rating": row["rating"],
            "items": items,
        })

    conn.close()
    return results
