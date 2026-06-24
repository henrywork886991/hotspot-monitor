#!/usr/bin/env python3
"""
enrich_rewrite_en.py — English sibling of enrich_rewrite.py.

Generates an ORIGINAL English article by rewriting the SAME source body the
Chinese rewrite uses (source → English), NOT by translating the zh rewrite —
so the English feed gets first-class, search/AI-citable content of its own.

It reuses every bit of enrich_rewrite's logic (prompt, retry, scoring) by
forcing REWRITE_LANG=en before importing that module; only the target columns
and row selection differ:

  Stores into hotspots:  article_md_en, article_title_en, article_score_en, article_words_en
  Backfill policy:        forward + recent — only articles fetched within
                          --max-age-hours (default 72h), so old items age out
                          rather than incurring a full back-translation cost.

Env:  DEEPSEEK_API_KEY (required), DEEPSEEK_API_BASE, DEEPSEEK_MODEL
Usage:
  python enrich_rewrite_en.py --limit 220
  python enrich_rewrite_en.py --id 7753,7907 --recheck     # dev: force re-run
  python enrich_rewrite_en.py --limit 500 --max-age-hours 0  # full backfill
"""

import os
# MUST precede the import below: enrich_rewrite reads REWRITE_LANG into module
# constants (_OUT_CJK / _OUT_LANG_NAME) at load time. Force English here.
os.environ["REWRITE_LANG"] = "en"

import sys
import argparse
import sqlite3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).parent))
import config_loader
import enrich_rewrite as er  # noqa: E402 — must import after setting REWRITE_LANG

DEFAULT_DB = config_loader.db_path()


def _ensure_cols_en(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    for name, decl in (("article_md_en", "TEXT"), ("article_title_en", "TEXT"),
                       ("article_score_en", "INTEGER"), ("article_words_en", "INTEGER")):
        if name not in cols:
            conn.execute(f"ALTER TABLE hotspots ADD COLUMN {name} {decl}")
    conn.commit()


def run(db_path: str, limit: int, ids: list[int], workers: int,
        recheck: bool, max_age_hours: int) -> None:
    if not er._API_KEY:
        print("ERROR: DEEPSEEK_API_KEY not set (source your .env).", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA busy_timeout=30000")   # survive the 2-hourly refresh writer
    conn.row_factory = sqlite3.Row
    _ensure_cols_en(conn)

    if ids:
        q = (f"SELECT id, title, COALESCE(NULLIF(fulltext,''), content, '') AS body "
             f"FROM hotspots WHERE id IN ({','.join('?' * len(ids))})")
        rows = conn.execute(q, ids).fetchall()
    else:
        where = ("category != 'markets' AND title != '' "
                 "AND length(COALESCE(NULLIF(fulltext,''),content,'')) >= ?")
        params: list = [er.MIN_BODY_CHARS]
        if not recheck:
            where += " AND (article_md_en IS NULL OR article_md_en = '')"
        # Forward + recent backfill: only translate articles fetched within the
        # window (0 = no limit, i.e. full backfill on demand).
        if max_age_hours > 0:
            where += " AND fetched_at >= datetime('now', ?)"
            params.append(f"-{int(max_age_hours)} hours")
        rows = conn.execute(
            f"""SELECT id, title, COALESCE(NULLIF(fulltext,''), content, '') AS body
                FROM hotspots WHERE {where}
                ORDER BY (importance IN ('urgent','high')) DESC,
                         COALESCE(NULLIF(published_at,''), fetched_at) DESC
                LIMIT ?""",
            (*params, limit),
        ).fetchall()

    print(f"Articles to rewrite (EN): {len(rows)}", file=sys.stderr)
    if not rows:
        conn.close()
        return

    hot_terms = er._trending_terms(conn)

    def work(row):
        res = er.rewrite_one(row["title"], row["body"] or "", hot_terms)
        return (row["id"], row["title"], res)

    ok = skipped = 0
    scores: list[int] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for rid, title, res in pool.map(work, rows):
            if not res:
                skipped += 1
                continue
            art, new_title, score, words = res
            conn.execute(
                "UPDATE hotspots SET article_md_en=?, article_title_en=?, "
                "article_score_en=?, article_words_en=? WHERE id=?",
                (art, new_title or None, score, words, rid),
            )
            ok += 1
            scores.append(score)
            print(f"  [{score:3}] {words:4}w  id={rid}  {(new_title or title)[:48]}", file=sys.stderr)
            if ok % 10 == 0:
                conn.commit()
    conn.commit()
    conn.close()
    avg = sum(scores) / len(scores) if scores else 0
    low = sum(1 for s in scores if s < er.SCORE_BAR)
    print(f"Done — EN rewrote {ok} (skipped {skipped} thin). avg score {avg:.0f}, "
          f"{low} below bar {er.SCORE_BAR}.", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description="Generate ORIGINAL English articles (article_md_en) via DeepSeek")
    p.add_argument("--db",      default=str(DEFAULT_DB))
    p.add_argument("--limit",   type=int, default=60, metavar="N")
    p.add_argument("--id",      default="", help="comma-separated article ids (dev)")
    p.add_argument("--workers", type=int, default=4, metavar="N")
    p.add_argument("--recheck", action="store_true")
    p.add_argument("--max-age-hours", type=int, default=72, metavar="H",
                   help="only translate articles fetched within H hours (0 = no limit / full backfill)")
    args = p.parse_args()
    ids = [int(x) for x in args.id.split(",") if x.strip().isdigit()]
    run(args.db, args.limit, ids, args.workers, args.recheck, args.max_age_hours)


if __name__ == "__main__":
    main()
