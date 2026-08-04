"""
One-time migration: copy the wardrobe out of local SQLite + Chroma into
Supabase Postgres (pgvector). Idempotent — TRUNCATEs the Postgres tables and
re-inserts, so it's safe to re-run.

Usage (after setting DATABASE_URL in backend/.env):

    cd backend
    ./venv/bin/python -m app.scripts.migrate_to_postgres

Verifies counts (items, wear_log, generated_outfits, embeddings) against the
source before finishing. The old local files (backend/data/wardrobe.db and
backend/data/chroma/) are left untouched — delete them once the API works
against Postgres.
"""

import json
import os
import sqlite3
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]  # backend/
SQLITE_PATH = REPO_ROOT / "data" / "wardrobe.db"
CHROMA_DIR = REPO_ROOT / "data" / "chroma"
CHROMA_COLLECTION = "wardrobe_items"

load_dotenv(REPO_ROOT / ".env")


def _read_sqlite():
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    items = [dict(r) for r in conn.execute("SELECT * FROM items").fetchall()]
    wear_log = [dict(r) for r in conn.execute("SELECT * FROM wear_log").fetchall()]
    outfits = [dict(r) for r in conn.execute("SELECT * FROM generated_outfits").fetchall()]
    conn.close()
    return items, wear_log, outfits


def _read_chroma_embeddings():
    import chromadb

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection = client.get_or_create_collection(name=CHROMA_COLLECTION)
    got = collection.get(include=["embeddings"])
    embeddings = {}
    if got and got["ids"]:
        for item_id, vec in zip(got["ids"], got["embeddings"]):
            embeddings[item_id] = list(vec)
    return embeddings


def _vec_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"


def main() -> None:
    conninfo = os.environ.get("DATABASE_URL", "").strip()
    if not conninfo:
        raise SystemExit(
            "DATABASE_URL is not set. Create a Supabase project, copy backend/.env.example "
            "to backend/.env, and add your connection string, then re-run."
        )
    if "sslmode" not in conninfo:
        conninfo += ("&" if "?" in conninfo else "?") + "sslmode=require"

    print(f"Reading {SQLITE_PATH} ...")
    items, wear_log, outfits = _read_sqlite()
    print(f"  sqlite: {len(items)} items, {len(wear_log)} wear_log, {len(outfits)} outfits")

    print(f"Reading Chroma embeddings from {CHROMA_DIR} ...")
    embeddings = _read_chroma_embeddings()
    with_emb = sum(1 for it in items if it["id"] in embeddings)
    print(f"  chroma: {len(embeddings)} embeddings ({with_emb} match items)")

    print("Connecting to Postgres ...")
    conn = psycopg.connect(conninfo)
    conn.autocommit = True

    from app.storage.db import init_db  # creates tables + extension

    init_db()

    conn.execute("TRUNCATE items, wear_log, generated_outfits RESTART IDENTITY CASCADE")

    # items (with embedding when available)
    for it in sorted(items, key=lambda i: i["created_at"] or ""):
        vec = embeddings.get(it["id"])
        cols = [
            "id", "image_path", "category", "subcategory", "primary_color",
            "secondary_color", "pattern", "formality", "seasons", "fabric_guess",
            "notes", "brand", "price", "purchase_date", "created_at",
        ]
        vals = [it.get(c) for c in cols]
        placeholders = ",".join(["%s"] * len(cols))
        if vec is not None:
            conn.execute(
                f"INSERT INTO items ({','.join(cols)}, embedding) VALUES ({placeholders}, %s::vector)",
                (*vals, _vec_literal(vec)),
            )
        else:
            conn.execute(
                f"INSERT INTO items ({','.join(cols)}) VALUES ({placeholders})", vals
            )

    # wear_log (ids are SERIAL — regenerate in original order)
    for w in sorted(wear_log, key=lambda r: r["id"]):
        conn.execute(
            "INSERT INTO wear_log (item_id, worn_on, outfit_id, rating) VALUES (%s, %s, %s, %s)",
            (w["item_id"], w["worn_on"], w["outfit_id"], w["rating"]),
        )

    # generated_outfits
    for o in sorted(outfits, key=lambda r: r["created_at"] or ""):
        conn.execute(
            """INSERT INTO generated_outfits
            (id, context_json, item_ids_json, reasoning, created_at, rating, worn_on)
            VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (o["id"], o["context_json"], o["item_ids_json"], o["reasoning"],
             o["created_at"], o["rating"], o["worn_on"]),
        )

    # --- verification ---
    def count(sql):
        return conn.execute(sql).fetchone()[0]

    n_items = count("SELECT COUNT(*) FROM items")
    n_wear = count("SELECT COUNT(*) FROM wear_log")
    n_outfits = count("SELECT COUNT(*) FROM generated_outfits")
    n_emb = count("SELECT COUNT(*) FROM items WHERE embedding IS NOT NULL")
    n_distinct_paths = count("SELECT COUNT(DISTINCT image_path) FROM items")

    print("\n=== Postgres after migration ===")
    print(f"  items:            {n_items}   (sqlite had {len(items)})")
    print(f"  distinct photos:  {n_distinct_paths}")
    print(f"  wear_log:         {n_wear}   (sqlite had {len(wear_log)})")
    print(f"  generated_outfits:{n_outfits}   (sqlite had {len(outfits)})")
    print(f"  embeddings:       {n_emb}   (chroma had {with_emb})")

    ok = (
        n_items == len(items)
        and n_wear == len(wear_log)
        and n_outfits == len(outfits)
        and n_emb == with_emb
        and n_distinct_paths == len({it["image_path"] for it in items})
    )
    if not ok:
        conn.close()
        raise SystemExit("VERIFICATION FAILED — counts do not match. Do not delete local files.")
    print("\nMigration OK — counts match. The old backend/data/wardrobe.db and "
          "backend/data/chroma/ can be deleted once the API works against Postgres.")


if __name__ == "__main__":
    main()
