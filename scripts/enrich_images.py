#!/usr/bin/env python3
"""
enrich_images.py — Backfill cover images for hotspots that have no image_url.

For each article still missing an image, fetch the page and read its
<meta property="og:image"> (or twitter:image). Only the first chunk of HTML
is downloaded (the <head>), so this is cheap. Runs concurrently.

Skips API/aggregator/markets sources that have no real article page.

Usage:
  python enrich_images.py                 # backfill up to 400 rows (default)
  python enrich_images.py --limit 100
  python enrich_images.py --source techcrunch
  python enrich_images.py --dry-run
  python enrich_images.py --db /path/db
"""

import re
import sys
import argparse
import sqlite3
from pathlib import Path
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader
from image_filter import is_low_quality_image

DEFAULT_DB = config_loader.db_path()

# Sources with no scrapable article page (APIs / social / price data)
_SKIP_SOURCES = frozenset({
    "coingecko", "coingecko_exchanges", "dexscreener",
    "hackernews", "twitter_buddy", "v2ex", "sopilot_twitter",
    "tradingview", "panews_articles", "panews_daily", "wallstcn",
})

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/124.0.0.0 Safari/537.36",
}
_HEAD_BYTES = 120_000   # only need the <head> for og:image

_META_PATTERNS = [
    re.compile(r'<meta[^>]+(?:property|name)=["\'](?:og:image(?::url)?|twitter:image(?::src)?)["\'][^>]+content=["\']([^"\']+)["\']', re.I),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image(?::url)?|twitter:image(?::src)?)["\']', re.I),
]
_IMG_WIDTH_META = re.compile(r'<meta[^>]+og:image:width["\'][^>]+content=["\'](\d+)["\']', re.I)


def fetch_og_image(url: str, timeout: int = 12) -> str | None:
    """Return a usable og:image / twitter:image URL, or None.
    Rejects logo/icon/small images so they fall back to the gradient placeholder."""
    try:
        with requests.get(url, headers=_HEADERS, timeout=timeout, stream=True, allow_redirects=True) as r:
            if r.status_code != 200:
                return None
            ctype = r.headers.get("Content-Type", "")
            if "html" not in ctype and ctype:
                return None
            html = ""
            for chunk in r.iter_content(chunk_size=16_384, decode_unicode=True):
                html += chunk if isinstance(chunk, str) else chunk.decode("utf-8", "ignore")
                if len(html) >= _HEAD_BYTES or "</head>" in html.lower():
                    break
    except Exception:
        return None

    wm = _IMG_WIDTH_META.search(html)
    declared_width = int(wm.group(1)) if wm else None

    for pat in _META_PATTERNS:
        m = pat.search(html)
        if m:
            img = m.group(1).strip()
            if img.startswith("//"):
                img = "https:" + img
            elif img.startswith("/"):
                img = urljoin(url, img)
            if img.startswith("http") and not is_low_quality_image(img, declared_width, probe=True):
                return img
    return None


def _ensure_column(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    if "image_url" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN image_url TEXT")
    if "img_checked" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN img_checked INTEGER DEFAULT 0")
    conn.commit()


def enrich(db_path: str, limit: int, source_filter: str | None, dry_run: bool, workers: int) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    _ensure_column(conn)

    skip = ",".join("?" * len(_SKIP_SOURCES))
    query = f"""
        SELECT id, url, source FROM hotspots
        WHERE (image_url IS NULL OR image_url = '')
          AND url != ''
          AND (category IS NULL OR category != 'markets')
          AND source NOT IN ({skip})
    """
    params: list = list(_SKIP_SOURCES)
    if source_filter:
        query += " AND source = ?"
        params.append(source_filter)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    print(f"Rows missing images: {len(rows)}", file=sys.stderr)

    if dry_run:
        for r in rows:
            print(f"  [DRY] {r['source']:22} {r['url'][:72]}")
        conn.close()
        return

    def work(row):
        return row["id"], row["source"], fetch_og_image(row["url"])

    ok = failed = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for rid, src, img in pool.map(work, rows):
            if img:
                conn.execute("UPDATE hotspots SET image_url = ?, img_checked = 1 WHERE id = ?", (img, rid))
                ok += 1
                print(f"  [OK ] {src:22} {img[:60]}", file=sys.stderr)
            else:
                failed += 1
                print(f"  [--- ] {src:22}", file=sys.stderr)
    conn.commit()
    conn.close()
    print(f"\nDone — images added: {ok} | still missing: {failed}", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description="Backfill cover images via og:image")
    p.add_argument("--db",      default=DEFAULT_DB, help="SQLite DB path")
    p.add_argument("--limit",   type=int, default=400, metavar="N")
    p.add_argument("--source",  metavar="SRC", help="Only this source")
    p.add_argument("--workers", type=int, default=12, metavar="N")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    enrich(args.db, args.limit, args.source, args.dry_run, args.workers)


if __name__ == "__main__":
    main()
