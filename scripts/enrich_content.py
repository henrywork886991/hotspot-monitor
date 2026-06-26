#!/usr/bin/env python3
"""
enrich_content.py — Fetch full article text for hotspots missing fulltext.

Strategy (per URL): trafilatura (fast, local extraction) first, Jina Reader
(handles JS-heavy pages) as fallback. Runs concurrently. Skips API/social
sources that have no article body.

Usage:
  python enrich_content.py                 # enrich up to 150 newest rows
  python enrich_content.py --limit 50
  python enrich_content.py --source coindesk
  python enrich_content.py --dry-run
"""

import sys
import argparse
import sqlite3
from copy import deepcopy
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

DEFAULT_DB = config_loader.db_path()

_JINA_BASE  = "https://r.jina.ai/"
_MIN_USEFUL = 350          # chars — below this, try the next extractor
_MAX_STORE  = 8000         # cap stored fulltext

_SKIP_SOURCES = frozenset({
    "coingecko", "coingecko_exchanges", "dexscreener",
    "hackernews", "twitter_buddy", "v2ex", "sopilot_twitter",
    "tradingview", "panews_articles", "panews_daily", "wallstcn",
})

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}

# trafilatura download timeout
try:
    import trafilatura
    from trafilatura.settings import DEFAULT_CONFIG
    _TRAF_CFG = deepcopy(DEFAULT_CONFIG)
    _TRAF_CFG["DEFAULT"]["DOWNLOAD_TIMEOUT"] = "12"
except Exception:  # pragma: no cover
    trafilatura = None
    _TRAF_CFG = None


def _via_trafilatura(url: str) -> str | None:
    if trafilatura is None:
        return None
    try:
        raw = trafilatura.fetch_url(url, config=_TRAF_CFG)
        if not raw:
            return None
        txt = trafilatura.extract(raw, include_comments=False, include_tables=False, config=_TRAF_CFG)
        if txt and len(txt) >= _MIN_USEFUL:
            return txt[:_MAX_STORE]
    except Exception:
        pass
    return None


def _via_jina(url: str) -> str | None:
    try:
        r = requests.get(_JINA_BASE + url, headers={**_HEADERS, "X-Return-Format": "text"}, timeout=20)
        if r.status_code == 200:
            txt = r.text.strip()
            if len(txt) >= _MIN_USEFUL:
                return txt[:_MAX_STORE]
    except Exception:
        pass
    return None


def fetch_fulltext(url: str) -> str | None:
    return _via_trafilatura(url) or _via_jina(url)


def _ensure_column(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    if "fulltext" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN fulltext TEXT")
        conn.commit()


def enrich(db_path: str, limit: int, source_filter: str | None, dry_run: bool, workers: int) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    _ensure_column(conn)

    skip = ",".join("?" * len(_SKIP_SOURCES))
    query = f"""
        SELECT id, url, source FROM hotspots
        WHERE fulltext IS NULL AND url != ''
          AND (category IS NULL OR category != 'markets')
          AND source NOT IN ({skip})
    """
    params: list = list(_SKIP_SOURCES)
    if source_filter:
        query += " AND source = ?"
        params.append(source_filter)
    # newest first so the freshest articles get full bodies first
    query += " ORDER BY COALESCE(NULLIF(published_at,''), fetched_at) DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    print(f"Rows to enrich: {len(rows)}", file=sys.stderr)

    if dry_run:
        for r in rows:
            print(f"  [DRY] {r['source']:20} {r['url'][:72]}")
        conn.close()
        return

    def work(row):
        return row["id"], row["source"], fetch_fulltext(row["url"])

    ok = failed = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for rid, src, text in pool.map(work, rows):
            if text:
                conn.execute("UPDATE hotspots SET fulltext = ? WHERE id = ?", (text, rid))
                ok += 1
                print(f"  [OK {len(text):5}c] {src}", file=sys.stderr)
            else:
                failed += 1
    conn.commit()
    conn.close()
    print(f"\nDone — fulltext added: {ok} | failed: {failed}", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description="Enrich hotspot fulltext (trafilatura + Jina)")
    p.add_argument("--db",       default=str(DEFAULT_DB))
    p.add_argument("--limit",    type=int, default=150, metavar="N")
    p.add_argument("--source",   metavar="SRC")
    p.add_argument("--workers",  type=int, default=8, metavar="N")
    p.add_argument("--dry-run",  action="store_true")
    args = p.parse_args()
    enrich(args.db, args.limit, args.source, args.dry_run, args.workers)


if __name__ == "__main__":
    main()
