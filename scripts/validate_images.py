#!/usr/bin/env python3
"""
validate_images.py — verify cover images are real photos, not small logos/avatars.

For each not-yet-checked row that has an image_url, read the image's real pixel
dimensions; if it's smaller than the cover threshold, clear it (so the UI shows a
clean gradient instead of a blurry upscaled logo). Marks rows img_checked=1 so
they aren't re-probed on the next run.

Usage:
  python validate_images.py            # check up to 600 unchecked images
  python validate_images.py --limit 200
  python validate_images.py --recheck  # re-probe everything (ignores img_checked)
"""

import sys
import argparse
import sqlite3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).parent))
import config_loader
from image_filter import is_low_quality_image

DEFAULT_DB = config_loader.db_path()


def _ensure_column(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    if "img_checked" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN img_checked INTEGER DEFAULT 0")
        conn.commit()


def validate(db_path: str, limit: int, workers: int, recheck: bool) -> None:
    conn = sqlite3.connect(db_path)
    _ensure_column(conn)

    where = "image_url != '' AND image_url IS NOT NULL"
    if not recheck:
        where += " AND (img_checked = 0 OR img_checked IS NULL)"
    rows = conn.execute(
        f"SELECT id, image_url FROM hotspots WHERE {where} "
        f"ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    print(f"Images to validate: {len(rows)}", file=sys.stderr)
    if not rows:
        conn.close()
        return

    def check(row):
        return row[0], is_low_quality_image(row[1], probe=True)

    cleared, kept = [], []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for rid, is_bad in pool.map(check, rows):
            (cleared if is_bad else kept).append(rid)

    if cleared:
        conn.executemany("UPDATE hotspots SET image_url='', img_checked=1 WHERE id=?", [(i,) for i in cleared])
    if kept:
        conn.executemany("UPDATE hotspots SET img_checked=1 WHERE id=?", [(i,) for i in kept])
    conn.commit()
    conn.close()
    print(f"Done — cleared {len(cleared)} small/logo images, kept {len(kept)}", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description="Validate cover images by real dimensions")
    p.add_argument("--db",      default=str(DEFAULT_DB))
    p.add_argument("--limit",   type=int, default=600, metavar="N")
    p.add_argument("--workers", type=int, default=16, metavar="N")
    p.add_argument("--recheck", action="store_true", help="re-probe already-checked rows")
    args = p.parse_args()
    validate(args.db, args.limit, args.workers, args.recheck)


if __name__ == "__main__":
    main()
