"""
One-time cleanup: the 47-item Phase 2 batch was ingested twice, so SQLite has
two rows per photo (95 rows / 48 distinct image_paths). Keep the earliest row
per image_path and delete the rest, then drop the matching Chroma embeddings.

Usage:
    python -m app.scripts.dedupe_items
"""

from collections import OrderedDict

from app.storage.db import get_connection, init_db


def main() -> None:
    init_db()
    conn = get_connection()

    rows = conn.execute(
        """SELECT id, image_path, created_at FROM items
        WHERE image_path IN (
            SELECT image_path FROM items
            GROUP BY image_path HAVING COUNT(*) > 1
        )
        ORDER BY image_path, created_at"""
    ).fetchall()

    by_path: "OrderedDict[str, list]" = OrderedDict()
    for row in rows:
        by_path.setdefault(row["image_path"], []).append(row["id"])

    keep_ids = [ids[0] for ids in by_path.values()]
    drop_ids = [i for ids in by_path.values() for i in ids[1:]]

    if not drop_ids:
        print("No duplicates found — nothing to do.")
        conn.close()
        return

    placeholders = ",".join("?" * len(drop_ids))

    # Safety: never drop a row still referenced by the wear log.
    orphan_wear = conn.execute(
        f"SELECT COUNT(*) FROM wear_log WHERE item_id IN ({placeholders})", drop_ids
    ).fetchone()[0]
    if orphan_wear:
        raise SystemExit(
            f"Aborting: {orphan_wear} wear_log rows reference duplicate items. "
            "Re-point them at a kept row before deduping."
        )

    for item_id in drop_ids:
        conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.commit()

    kept = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    distinct = conn.execute("SELECT COUNT(DISTINCT image_path) FROM items").fetchone()[0]
    conn.close()

    print(f"Dropped {len(drop_ids)} duplicate rows ({len(keep_ids)} kept).")
    print(f"items now: {kept} (distinct photos: {distinct})")

    # Drop the matching Chroma embeddings for the removed ids.
    try:
        from app.storage.vectors import _get_collection
        collection = _get_collection()
        existing = collection.get(include=[])
        to_remove = [i for i in drop_ids if i in (existing["ids"] or [])]
        if to_remove:
            collection.delete(ids=to_remove)
            print(f"Removed {len(to_remove)} embeddings from Chroma.")
        else:
            print("No matching embeddings found in Chroma.")
    except Exception as exc:  # pragma: no cover - Chroma may be unavailable
        print(f"Could not update Chroma: {exc}")


if __name__ == "__main__":
    main()