#!/usr/bin/env python3
"""
query_db.py — Query the hotspot SQLite database.
Outputs a JSON array to stdout (pipe to Claude Code for analysis).

Usage:
  python query_db.py --recent 24              # hotspots from last 24h
  python query_db.py --recent 48 --category crypto
  python query_db.py --source coindesk --recent 24
  python query_db.py --keyword "Bitcoin"      # title/content contains keyword
  python query_db.py --stats                  # show DB statistics
  python query_db.py --runs                   # show collection run history
"""

import sys
import json
import sqlite3
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path

import config_loader
DEFAULT_DB = config_loader.db_path()


def get_db(path: str) -> sqlite3.Connection:
    if not Path(path).exists():
        print(f"ERROR: Database not found: {path}", file=sys.stderr)
        print("Run: python collect_trend.py | python save_to_db.py", file=sys.stderr)
        sys.exit(1)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def query_recent(conn, hours: int, category: str | None, source: str | None,
                 keyword: str | None, limit: int) -> list[dict]:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    sql = "SELECT * FROM hotspots WHERE fetched_at >= ?"
    params: list = [cutoff]
    if category:
        sql += " AND (category = ? OR category IS NULL)"
        params.append(category)
    if source:
        sql += " AND source = ?"
        params.append(source)
    if keyword:
        sql += " AND (title LIKE ? OR content LIKE ?)"
        params.extend([f"%{keyword}%", f"%{keyword}%"])
    sql += " ORDER BY fetched_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def show_stats(conn) -> None:
    total = conn.execute("SELECT COUNT(*) FROM hotspots").fetchone()[0]
    print(f"\n{'═'*50}")
    print(f"  Hotspot Database Statistics")
    print(f"{'═'*50}")
    print(f"  Total hotspots: {total}")

    print(f"\n  By source:")
    for row in conn.execute(
        "SELECT source, COUNT(*) as cnt FROM hotspots GROUP BY source ORDER BY cnt DESC"
    ):
        print(f"    {row['source']:25s} {row['cnt']:>5}")

    print(f"\n  Recent activity (last 7 days):")
    for row in conn.execute(
        "SELECT date(fetched_at) as day, COUNT(*) as cnt "
        "FROM hotspots WHERE fetched_at >= datetime('now', '-7 days') "
        "GROUP BY day ORDER BY day DESC"
    ):
        print(f"    {row['day']}  {row['cnt']:>4} items")

    runs = conn.execute("SELECT COUNT(*) FROM collection_runs").fetchone()[0]
    print(f"\n  Collection runs: {runs}")


def show_runs(conn, limit: int = 20) -> None:
    print(f"\n{'─'*70}")
    print(f"  {'run_at':<25} {'new':>5} {'total':>6}  sources")
    print(f"{'─'*70}")
    for row in conn.execute(
        "SELECT * FROM collection_runs ORDER BY run_at DESC LIMIT ?", (limit,)
    ):
        sources = json.loads(row["sources_used"] or "[]")
        src_str = ", ".join(sources[:4]) + ("..." if len(sources) > 4 else "")
        print(f"  {row['run_at']:<25} {row['items_new']:>5} {row['items_fetched']:>6}  {src_str}")


def main():
    p = argparse.ArgumentParser(description="Query the hotspot database")
    p.add_argument("--db",       default=str(DEFAULT_DB))
    p.add_argument("--recent",   type=int, default=24, metavar="HOURS",
                   help="Hours to look back (default: 24)")
    p.add_argument("--category", choices=["crypto", "tech", "all"], default=None)
    p.add_argument("--source",   help="Filter by source name (e.g. coindesk)")
    p.add_argument("--keyword",  help="Filter by keyword in title/content")
    p.add_argument("--limit",    type=int, default=200)
    p.add_argument("--stats",    action="store_true", help="Show DB statistics")
    p.add_argument("--runs",     action="store_true", help="Show collection run history")
    p.add_argument("--pretty",   action="store_true")
    args = p.parse_args()

    conn = get_db(args.db)

    if args.stats:
        show_stats(conn)
        if args.runs:
            show_runs(conn)
        conn.close()
        return

    if args.runs:
        show_runs(conn)
        conn.close()
        return

    results = query_recent(conn, args.recent, args.category, args.source,
                           args.keyword, args.limit)
    conn.close()

    print(f"Query: last {args.recent}h | {len(results)} items", file=sys.stderr)
    indent = 2 if args.pretty else None
    print(json.dumps(results, ensure_ascii=False, indent=indent, default=str))


if __name__ == "__main__":
    main()
