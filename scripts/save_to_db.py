#!/usr/bin/env python3
"""
save_to_db.py — Read hotspot JSON from stdin, save new items to SQLite.
Deduplicates by URL. Prints a summary of what was saved.

Usage:
  python collect_trend.py | python save_to_db.py
  python collect_keyword.py "Bitcoin" | python save_to_db.py
  python save_to_db.py --db /path/to/hotspots.db   # custom DB path
  python save_to_db.py --help

Schema:
  hotspots         — main content table (deduped by URL)
  collection_runs  — log of each run (timestamp, count, sources)

The DB is created automatically on first run.
"""

import sys
import json
import sqlite3
import argparse
from datetime import datetime, timezone
from pathlib import Path

import config_loader
DEFAULT_DB = config_loader.db_path()

SCHEMA = """
CREATE TABLE IF NOT EXISTS hotspots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    content      TEXT,
    fulltext     TEXT,
    url          TEXT    NOT NULL UNIQUE,
    source       TEXT    NOT NULL,
    source_type  TEXT,
    category     TEXT,
    published_at TEXT,
    image_url    TEXT,
    img_checked  INTEGER DEFAULT 0,
    importance   TEXT    DEFAULT 'unanalyzed',
    summary      TEXT,
    keywords     TEXT,
    relevance    INTEGER,
    is_real      INTEGER DEFAULT 1,
    fetched_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    category     TEXT,
    sources_used TEXT,
    items_fetched INTEGER,
    items_new    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hotspots_source   ON hotspots(source);
CREATE INDEX IF NOT EXISTS idx_hotspots_fetched  ON hotspots(fetched_at);
CREATE INDEX IF NOT EXISTS idx_hotspots_category ON hotspots(category);
"""


def get_db(path: str) -> sqlite3.Connection:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    # Migrate existing DBs that predate the fulltext column
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    if "fulltext" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN fulltext TEXT")
    if "image_url" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN image_url TEXT")
    if "img_checked" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN img_checked INTEGER DEFAULT 0")
    if "symbols" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN symbols TEXT")
    conn.commit()
    return conn


def _published_age_days(s: str) -> float | None:
    """Age in days of a published_at string, or None if it can't be parsed."""
    s = (s or "").strip()
    if not s:
        return None
    dt = None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(s)
        except (TypeError, ValueError):
            return None
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - dt).total_seconds() / 86400


def _normalize_published(s: str) -> str:
    """Reformat any published_at into SQLite-comparable UTC 'YYYY-MM-DD HH:MM:SS'
    (same shape as fetched_at) so the feed can sort by publish time. '' if unknown."""
    s = (s or "").strip()
    if not s:
        return ""
    dt = None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(s)
        except (TypeError, ValueError):
            return ""
    if dt is None:
        return ""
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def filter_fresh(items: list[dict], max_age_days: float) -> tuple[list[dict], int]:
    """Drop items whose published_at parses to older than max_age_days.
    Items with no/undatable published_at (live snapshots, e.g. trending APIs)
    are kept — we only drop things we can prove are stale."""
    if max_age_days <= 0:
        return items, 0
    kept, dropped = [], 0
    for it in items:
        age = _published_age_days(it.get("published_at", ""))
        if age is not None and age > max_age_days:
            dropped += 1
            continue
        kept.append(it)
    return kept, dropped


def save_items(conn: sqlite3.Connection, items: list[dict]) -> tuple[int, int]:
    """Insert items, skip duplicates (UNIQUE url). Returns (attempted, inserted)."""
    inserted = 0
    for item in items:
        try:
            conn.execute(
                """INSERT INTO hotspots
                   (title, content, fulltext, url, source, source_type, category, published_at, image_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    item.get("title", "")[:500],
                    item.get("content", "")[:2000],
                    item.get("fulltext") or None,
                    item.get("url", ""),
                    item.get("source", ""),
                    item.get("source_type", ""),
                    item.get("category") or None,
                    _normalize_published(item.get("published_at", "")),
                    item.get("image_url") or None,
                ),
            )
            inserted += 1
        except sqlite3.IntegrityError:
            pass  # duplicate URL — skip
    conn.commit()
    return len(items), inserted


def log_run(conn: sqlite3.Connection, items: list[dict], inserted: int) -> None:
    sources = sorted({i.get("source", "") for i in items})
    conn.execute(
        """INSERT INTO collection_runs (sources_used, items_fetched, items_new)
           VALUES (?, ?, ?)""",
        (json.dumps(sources), len(items), inserted),
    )
    conn.commit()


def main():
    p = argparse.ArgumentParser(description="Save hotspot JSON (stdin) to SQLite")
    p.add_argument("--db", default=str(DEFAULT_DB), help="SQLite database path")
    p.add_argument("--max-age-days", type=float, default=3.0,
                   help="Drop items published older than this (0 = keep all). "
                        "Undated live snapshots are always kept.")
    args = p.parse_args()

    raw = sys.stdin.read().strip()
    if not raw:
        print("ERROR: no JSON on stdin. Pipe output from collect_trend.py", file=sys.stderr)
        sys.exit(1)

    try:
        items: list[dict] = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"ERROR: invalid JSON — {e}", file=sys.stderr)
        sys.exit(1)

    items, stale = filter_fresh(items, args.max_age_days)

    conn = get_db(args.db)
    attempted, inserted = save_items(conn, items)
    log_run(conn, items, inserted)
    conn.close()

    print(f"DB: {args.db}")
    print(f"Stale dropped (> {args.max_age_days}d): {stale}")
    print(f"Attempted: {attempted} | New: {inserted} | Duplicates skipped: {attempted - inserted}")


if __name__ == "__main__":
    main()
