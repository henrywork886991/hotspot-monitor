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


def _is_translated(t: str) -> bool:
    """For a zh-Hant target, a real translation is Han-dominant with no Korean and
    little Japanese kana — catches headlines the model left in the source language."""
    if not er.REWRITE_LANG.startswith("zh"):
        return bool(t)
    han = len(er._HAN.findall(t))
    return han >= 4 and not er._HANGUL.search(t) and len(er._KANA.findall(t)) <= 2


def _translate_batch(items: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Translate (title, summary) pairs into the target language. Returns the same
    number of (title, summary) pairs, in order; [] on failure."""
    lang = er._OUT_LANG_NAME
    numbered = "\n".join(
        f"{i+1}. TITLE: {t}\n   SUMMARY: {s[:300]}" for i, (t, s) in enumerate(items)
    )
    sys_msg = (
        f"You translate crypto/finance news into {lang}. For EACH item translate the "
        "title and the summary, including English/日本語/한국어 ones — the output must "
        "contain no untranslated source-language words (keep only tickers like BTC and "
        "brand names like SpaceX). Convert any Simplified Chinese to Traditional. Be "
        "faithful and concise, no clickbait; the summary stays 1-2 sentences. If a "
        "summary is empty, return an empty string for it. "
        'Return ONLY a JSON object {"items": [{"title": "...", "summary": "..."}, ...]} '
        "with exactly the same number of items, in the same order."
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
                "max_tokens": 2600,
            },
            timeout=120,
        )
        if r.status_code != 200:
            return []
        out = json.loads(r.json()["choices"][0]["message"]["content"]).get("items") or []
        return [(str(o.get("title", "")).strip(), str(o.get("summary", "")).strip()) for o in out]
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
    for name in ("article_title", "summary_zh"):
        if name not in cols:
            conn.execute(f"ALTER TABLE hotspots ADD COLUMN {name} TEXT")
    conn.commit()

    where = ("category != 'markets' AND title != '' "
             "AND length(COALESCE(NULLIF(fulltext,''),content,'')) < ?")
    if not recheck:
        where += " AND (article_title IS NULL OR article_title = '')"
    rows = conn.execute(
        f"""SELECT id, title, COALESCE(summary,'') AS summary FROM hotspots WHERE {where}
            ORDER BY COALESCE(NULLIF(published_at,''), fetched_at) DESC LIMIT ?""",
        (er.MIN_BODY_CHARS, limit),
    ).fetchall()
    print(f"Thin headlines to translate: {len(rows)}", file=sys.stderr)
    if not rows:
        conn.close()
        return

    id_data = {r["id"]: (r["title"], r["summary"]) for r in rows}

    def work(batch):
        """Return [(id, title|None, summary)] — None title means failed language check."""
        out = _translate_batch([id_data[i] for i in batch])
        if len(out) != len(batch):
            out = [("", "")] * len(batch)
        return [(i, (t if _is_translated(t) else None), s) for i, (t, s) in zip(batch, out)]

    def pass_over(ids: list[int], size: int) -> list[int]:
        """Translate+store the good ones; return the ids that still failed."""
        nonlocal ok
        batches = [ids[i:i + size] for i in range(0, len(ids), size)]
        failed: list[int] = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for res in pool.map(work, batches):
                for rid, t, s in res:
                    if t:
                        conn.execute(
                            "UPDATE hotspots SET article_title=?, summary_zh=? WHERE id=?",
                            (t[:300], (s[:600] or None), rid))
                        ok += 1
                    else:
                        failed.append(rid)
                conn.commit()
                print(f"  translated {ok}/{len(rows)}", file=sys.stderr)
        return failed

    ok = 0
    pending = pass_over(list(id_data), BATCH)
    # Retry stragglers (often English headlines the model left as-is) in small batches.
    if pending:
        print(f"  retrying {len(pending)} untranslated…", file=sys.stderr)
        still = pass_over(pending, 6)
        # Clear any stale wrong-language title so it isn't shown and is retried next run.
        for rid in still:
            conn.execute("UPDATE hotspots SET article_title=NULL WHERE id=?", (rid,))
        conn.commit()
        print(f"  {len(still)} still untranslated → cleared for next run", file=sys.stderr)
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
