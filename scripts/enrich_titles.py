#!/usr/bin/env python3
"""
enrich_titles.py — batched headline translation for THIN articles via DeepSeek V4.

Articles with too little body to rewrite (headline + tiny snippet) are skipped by
enrich_rewrite.py, so their feed cards would still show the source language. This
fills only their `article_title` with a unified-language headline, in batches of
~15 per call (cheap), so the whole feed reads in one language.

Disjoint from enrich_rewrite (which handles body >= MIN_BODY_CHARS); this only
touches the thin remainder, so the two can run together.

Env:  DEEPSEEK_API_KEY, DEEPSEEK_API_BASE, DEEPSEEK_MODEL, REWRITE_LANG
Usage:  python enrich_titles.py --limit 4000
"""

import os
import sys
import json
import argparse
import sqlite3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader
import enrich_rewrite as er          # reuse API config, MIN_BODY_CHARS, lang name

DEFAULT_DB = config_loader.db_path()
BATCH = 15


def _translate_batch(titles: list[str]) -> list[str]:
    lang = er._OUT_LANG_NAME
    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(titles))
    sys_msg = (
        f"You translate news headlines into {lang}. Keep them faithful and concise; "
        "keep tickers, names and numbers; no clickbait. If a headline is already in "
        f"{lang}, just normalise it (and convert any Simplified Chinese to Traditional). "
        'Return ONLY a JSON object {"titles": [...]} with exactly the same number of '
        "items, in the same order."
    )
    try:
        r = requests.post(
            f"{er._API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {er._API_KEY}", "Content-Type": "application/json"},
            json={
                "model": er._MODEL,
                "messages": [{"role": "system", "content": sys_msg},
                             {"role": "user", "content": numbered}],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
                "max_tokens": 1500,
            },
            timeout=90,
        )
        if r.status_code != 200:
            return []
        out = json.loads(r.json()["choices"][0]["message"]["content"]).get("titles") or []
        return [str(t).strip() for t in out]
    except Exception:
        return []


def run(db_path: str, limit: int, workers: int, recheck: bool) -> None:
    if not er._API_KEY:
        print("ERROR: DEEPSEEK_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA busy_timeout=30000")
    conn.row_factory = sqlite3.Row
    # Make sure the column exists (enrich_rewrite owns the canonical schema).
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    if "article_title" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN article_title TEXT")
        conn.commit()

    where = ("category != 'markets' AND title != '' "
             "AND length(COALESCE(NULLIF(fulltext,''),content,'')) < ?")
    if not recheck:
        where += " AND (article_title IS NULL OR article_title = '')"
    rows = conn.execute(
        f"""SELECT id, title FROM hotspots WHERE {where}
            ORDER BY COALESCE(NULLIF(published_at,''), fetched_at) DESC LIMIT ?""",
        (er.MIN_BODY_CHARS, limit),
    ).fetchall()
    print(f"Thin headlines to translate: {len(rows)}", file=sys.stderr)
    if not rows:
        conn.close()
        return

    batches = [rows[i:i + BATCH] for i in range(0, len(rows), BATCH)]

    def work(batch):
        out = _translate_batch([r["title"] for r in batch])
        if len(out) != len(batch):
            return []
        return [(b["id"], t) for b, t in zip(batch, out) if t]

    ok = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for pairs in pool.map(work, batches):
            for rid, t in pairs:
                conn.execute("UPDATE hotspots SET article_title=? WHERE id=?", (t[:300], rid))
                ok += 1
            conn.commit()
            print(f"  translated {ok}/{len(rows)}", file=sys.stderr)
    conn.close()
    print(f"Done — translated {ok} thin headlines.", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description="Batched thin-headline translation via DeepSeek")
    p.add_argument("--db",      default=str(DEFAULT_DB))
    p.add_argument("--limit",   type=int, default=4000, metavar="N")
    p.add_argument("--workers", type=int, default=4, metavar="N")
    p.add_argument("--recheck", action="store_true")
    args = p.parse_args()
    run(args.db, args.limit, args.workers, args.recheck)


if __name__ == "__main__":
    main()
