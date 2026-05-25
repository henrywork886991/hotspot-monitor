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
    conn.commit()
    return conn


def save_items(conn: sqlite3.Connection, items: list[dict]) -> tuple[int, int]:
    """Insert items, skip duplicates (UNIQUE url). Returns (attempted, inserted)."""
    inserted = 0
    for item in items:
        try:
            conn.execute(
                """INSERT INTO hotspots
                   (title, content, fulltext, url, source, source_type, published_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    item.get("title", "")[:500],
                    item.get("content", "")[:2000],
                    item.get("fulltext") or None,
                    item.get("url", ""),
                    item.get("source", ""),
                    item.get("source_type", ""),
                    item.get("published_at", ""),
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

    conn = get_db(args.db)
    attempted, inserted = save_items(conn, items)
    log_run(conn, items, inserted)
    conn.close()

    print(f"DB: {args.db}")
    print(f"Attempted: {attempted} | New: {inserted} | Duplicates skipped: {attempted - inserted}")


if __name__ == "__main__":
    main()
