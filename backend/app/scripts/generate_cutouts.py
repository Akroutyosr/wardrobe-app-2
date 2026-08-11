"""
Backfill: generate and persist a transparent cutout for every item.

Idempotent -- generate_cutout() caches to disk, so re-runs never recompute an
existing cutout and items that already have a cutout_path are skipped.

If the database is unreachable it still generates every cutout from the photos
directory (the expensive part needs no DB) and warns that the cutout_path
write-back must be re-run later. Re-run this script until it reports the DB
backfill as done.

Usage (from backend/):
    python -m app.scripts.generate_cutouts
"""

from pathlib import Path

from app.storage.db import (
    CUTOUT_DIR,
    REPO_ROOT,
    generate_cutout,
    init_db,
    list_items,
    set_item_cutout,
)


def _photos_dir() -> Path:
    return REPO_ROOT / "data" / "photos"


def _generate_for(image_paths: list[str]) -> tuple[int, int]:
    done = failed = 0
    for image_path in image_paths:
        try:
            generate_cutout(image_path)  # cached: no-op if already generated
            done += 1
        except Exception as exc:
            failed += 1
            print(f"  FAIL {image_path}: {exc}")
    return done, failed


def _db_backfill() -> None:
    init_db()
    items = list_items()
    print(f"DB backfill: {len(items)} items…")
    done = skipped = failed = 0
    for item in items:
        item_id, image_path = item["id"], item["image_path"]
        if item.get("cutout_path"):
            skipped += 1
            continue
        try:
            cutout = generate_cutout(image_path)
            set_item_cutout(item_id, cutout)
            done += 1
        except Exception as exc:
            failed += 1
            print(f"  FAIL {item_id} ({image_path}): {exc}")
    print(f"DB backfill complete: written={done} skipped={skipped} failed={failed}")
    if failed:
        raise SystemExit(1)


def main() -> None:
    try:
        _db_backfill()
        return
    except Exception as exc:
        print(f"DB unreachable ({type(exc).__name__}); generating cutouts from disk only. "
              f"Re-run later to persist cutout_path rows.\n  detail: {str(exc)[:120]}")

    photos = sorted(
        p for p in _photos_dir().iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )
    print(f"Generating {len(photos)} cutouts from {_photos_dir()}…")
    done, failed = _generate_for([str(p) for p in photos])
    print(f"cutout files: generated/skipped={done} failed={failed} -> {CUTOUT_DIR}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
