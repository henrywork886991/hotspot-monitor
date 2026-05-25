#!/usr/bin/env python3
"""
enrich_content.py — Fetch full article text for hotspots with missing fulltext.

Strategy (per URL):
  1. Jina Reader (r.jina.ai) — handles JS rendering
  2. trafilatura             — fast HTML extractor, fallback

Skips API/aggregator sources that don't have article pages.

Usage:
  python enrich_content.py                  # enrich up to 100 rows (default)
  python enrich_content.py --limit 50       # process at most 50 rows
  python enrich_content.py --source coindesk  # only enrich rows from one source
  python enrich_content.py --dry-run        # list targets without fetching
  python enrich_content.py --db /path/db    # custom DB path
"""

import sys
import time
import argparse
import sqlite3
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

DEFAULT_DB = config_loader.db_path()

_JINA_BASE = "https://r.jina.ai/"
_MIN_USEFUL = 300        # chars — below this, text is considered useless
_MAX_STORE  = 8000       # chars — cap stored fulltext

# API / social sources with no article body to scrape
_SKIP_SOURCES = frozenset({
    "coingecko", "coingecko_exchanges", "dexscreener",
    "hackernews", "twitter_buddy", "v2ex", "sopilot_twitter",
    "tradingview", "panews_articles", "panews_daily",
    "wallstcn",
})

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/124.0.0.0 Safari/537.36",
}


def fetch_fulltext(url: str, timeout: int = 20) -> str | None:
    """Fetch full article text. Jina first, trafilatura fallback. Returns text or None."""
    # ── Jina Reader ──────────────────────────────────────────────────────────
    try:
        resp = requests.get(
            _JINA_BASE + url,
            headers={**_HEADERS, "X-Return-Format": "text"},
            timeout=timeout,
        )
        if resp.status_code == 200:
            text = resp.text.strip()
            if len(text) >= _MIN_USEFUL:
                return text[:_MAX_STORE]
    except Exception:
        pass

    # ── trafilatura fallback ─────────────────────────────────────────────────
    try:
        import trafilatura
        raw = trafilatura.fetch_url(url)
        if raw:
            text = trafilatura.extract(raw)
            if text and len(text) >= _MIN_USEFUL:
                return text[:_MAX_STORE]
    except Exception:
        pass

    return None


def _ensure_fulltext_column(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    if "fulltext" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN fulltext TEXT")
        conn.commit()
        print("[DB] Added fulltext column", file=sys.stderr)


def enrich(db_path: str, limit: int, source_filter: str | None, dry_run: bool) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    _ensure_fulltext_column(conn)

    skip_placeholders = ",".join("?" * len(_SKIP_SOURCES))
    base_query = f"""
        SELECT id, url, source, length(content) AS clen
        FROM hotspots
        WHERE fulltext IS NULL
          AND url != ''
          AND source NOT IN ({skip_placeholders})
    """
    params: list = list(_SKIP_SOURCES)

    if source_filter:
        base_query += " AND source = ?"
        params.append(source_filter)

    base_query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(base_query, params).fetchall()
    print(f"Rows to enrich: {len(rows)}", file=sys.stderr)

    ok = failed = 0
    for row in rows:
        url = row["url"]
        src = row["source"]
        clen = row["clen"] or 0

        if dry_run:
            print(f"  [DRY] {src:25} content={clen:4}c  {url[:70]}")
            continue

        text = fetch_fulltext(url)
        if text:
            conn.execute("UPDATE hotspots SET fulltext = ? WHERE id = ?", (text, row["id"]))
            conn.commit()
            ok += 1
            print(f"  [OK  {len(text):5}c] {src:25} {url[:55]}", file=sys.stderr)
        else:
            failed += 1
            print(f"  [FAIL]        {src:25} {url[:55]}", file=sys.stderr)

        time.sleep(0.4)  # polite rate limit

    conn.close()
    if not dry_run:
        print(f"\nDone — enriched: {ok} | failed: {failed}", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description="Enrich hotspot fulltext via Jina + trafilatura")
    p.add_argument("--db",       default=DEFAULT_DB, help="SQLite DB path")
    p.add_argument("--limit",    type=int, default=100, metavar="N",
                   help="Max rows to process (default: 100)")
    p.add_argument("--source",   metavar="SRC",
                   help="Only enrich rows from this source (e.g. coindesk)")
    p.add_argument("--dry-run",  action="store_true",
                   help="List targets without fetching")
    args = p.parse_args()

    enrich(args.db, args.limit, args.source, args.dry_run)


if __name__ == "__main__":
    main()
