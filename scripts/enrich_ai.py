#!/usr/bin/env python3
"""
enrich_ai.py — AI transformation of articles via DeepSeek V4 (OpenAI-compatible).

One call per article returns:
  • summary  — a 2-3 sentence answer-box (same language as the article)
  • keywords — 5-8 search terms / entities
  • coins    — cryptocurrency tickers discussed → matched against BYDFi's
               tradeable list (data/bydfi_symbols.json) and stored as trade pairs

Env (e.g. from a gitignored .env):
  DEEPSEEK_API_KEY   (required)
  DEEPSEEK_API_BASE  default https://api.deepseek.com/v1
  DEEPSEEK_MODEL     default deepseek-chat   (resolves to deepseek-v4)

Usage:
  python enrich_ai.py                 # enrich up to 120 (important+newest) articles
  python enrich_ai.py --limit 50
  python enrich_ai.py --recheck       # re-run even if summary exists
"""

import os
import re
import sys
import json
import argparse
import sqlite3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

DEFAULT_DB = config_loader.db_path()
_SYMBOLS_FILE = Path(DEFAULT_DB).parent / "bydfi_symbols.json"

_API_KEY  = os.environ.get("DEEPSEEK_API_KEY", "")
_API_BASE = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")
_MODEL    = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

_SYS = (
    "You are a crypto and finance news editor. Read the article and return ONLY a "
    "JSON object with these keys:\n"
    '  "summary":  a factual 2-3 sentence answer-box that leads with the key fact, '
    "in the SAME language as the article title.\n"
    '  "keywords": array of 5-8 short search terms / entities (people, projects, '
    "tickers, themes), in the article's language.\n"
    '  "coins":    array of cryptocurrency TICKER symbols explicitly discussed '
    '(uppercase, e.g. ["BTC","ETH","SOL"]); empty array if none.\n'
    "Be accurate; do not invent coins that are not in the text."
)


def _load_symbols() -> dict[str, str]:
    try:
        return json.loads(_SYMBOLS_FILE.read_text())
    except Exception:
        return {}


def _call_llm(title: str, body: str, timeout: int = 40) -> dict | None:
    content = f"TITLE: {title}\n\nBODY:\n{body[:4000]}"
    try:
        r = requests.post(
            f"{_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": _MODEL,
                "messages": [{"role": "system", "content": _SYS},
                             {"role": "user", "content": content}],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
                "max_tokens": 500,
            },
            timeout=timeout,
        )
        if r.status_code != 200:
            return None
        txt = r.json()["choices"][0]["message"]["content"]
        txt = re.sub(r"^```(?:json)?|```$", "", txt.strip()).strip()
        return json.loads(txt)
    except Exception:
        return None


def _match_coins(coins, symbols: dict[str, str]) -> str:
    pairs, seen = [], set()
    for c in coins or []:
        t = re.sub(r"[^A-Z0-9]", "", str(c).upper())
        if t in symbols and t not in seen:
            seen.add(t)
            pairs.append(symbols[t])
    return ",".join(pairs)


def _ensure_cols(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    if "symbols" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN symbols TEXT")
        conn.commit()


def enrich(db_path: str, limit: int, workers: int, recheck: bool) -> None:
    if not _API_KEY:
        print("ERROR: DEEPSEEK_API_KEY not set (source your .env).", file=sys.stderr)
        sys.exit(1)

    symbols = _load_symbols()
    if not symbols:
        print("WARN: data/bydfi_symbols.json missing — run fetch_bydfi_symbols.py "
              "(coins won't be matched).", file=sys.stderr)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    _ensure_cols(conn)

    where = "category != 'markets' AND title != ''"
    if not recheck:
        where += " AND (summary IS NULL OR summary = '')"
    rows = conn.execute(
        f"""SELECT id, title, COALESCE(NULLIF(fulltext,''), content, '') AS body
            FROM hotspots WHERE {where}
            ORDER BY (importance IN ('urgent','high')) DESC,
                     COALESCE(NULLIF(published_at,''), fetched_at) DESC
            LIMIT ?""",
        (limit,),
    ).fetchall()
    print(f"Articles to AI-enrich: {len(rows)}", file=sys.stderr)
    if not rows:
        conn.close()
        return

    def work(row):
        data = _call_llm(row["title"], row["body"] or row["title"])
        if not data:
            return None
        summary = (data.get("summary") or "").strip()[:600]
        kws = data.get("keywords") or []
        keywords = ", ".join(str(k).strip() for k in kws[:8] if str(k).strip())
        syms = _match_coins(data.get("coins"), symbols)
        if not summary:
            return None
        return row["id"], summary, keywords, syms

    ok = coins_found = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for res in pool.map(work, rows):
            if not res:
                continue
            rid, summary, keywords, syms = res
            conn.execute(
                "UPDATE hotspots SET summary=?, keywords=?, symbols=? WHERE id=?",
                (summary, keywords, syms, rid),
            )
            ok += 1
            if syms:
                coins_found += 1
            if ok % 20 == 0:
                conn.commit()
    conn.commit()
    conn.close()
    print(f"Done — enriched {ok} articles ({coins_found} with tradeable coins)", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description="AI-enrich articles via DeepSeek")
    p.add_argument("--db",      default=str(DEFAULT_DB))
    p.add_argument("--limit",   type=int, default=120, metavar="N")
    p.add_argument("--workers", type=int, default=6, metavar="N")
    p.add_argument("--recheck", action="store_true")
    args = p.parse_args()
    enrich(args.db, args.limit, args.workers, args.recheck)


if __name__ == "__main__":
    main()
