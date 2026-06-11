#!/usr/bin/env python3
"""
classify_importance.py — Rule-based importance classification for hotspots.

Classifies unanalyzed articles into: urgent / high / medium / low
Based on title + content keywords. No API key needed.

Usage:
  python scripts/classify_importance.py           # classify all unanalyzed
  python scripts/classify_importance.py --dry-run # preview without saving
  python scripts/classify_importance.py --all     # re-classify everything
"""

import sqlite3
import argparse
import re
import sys
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent))
import config_loader

DB_PATH = config_loader.db_path()

# ── Keyword rules (checked in order, first match wins) ──────────────────────

URGENT_PATTERNS = [
    r'\b(hack|exploit|hacked|breach|stolen|rug\s*pull|exit\s*scam)\b',
    r'\b(crash|collapse|bankrupt|insolvency|liquidat(ed|ion)|margin\s*call)\b',
    r'\b(breaking|urgent|emergency|alert|critical|major\s*outage)\b',
    r'\b(SEC\s*(charge|sue|lawsuit|action|crackdown)|DOJ|arrest)\b',
    r'\b(flash\s*crash|circuit\s*breaker|trading\s*halt)\b',
    r'\b(war|sanction|ban|blocked|seized|shut\s*down)\b',
    r'\b(vulnerability|zero.?day|CVE-\d+)\b',
]

HIGH_PATTERNS = [
    r'\b(ETF|spot\s*bitcoin|bitcoin\s*ETF|ethereum\s*ETF)\b',
    r'\b(Fed|Federal\s*Reserve|FOMC|rate\s*hike|rate\s*cut|interest\s*rate)\b',
    r'\b(IPO|acquisition|merger|partnership|deal|agreement)\b',
    r'\b(launch(ed|es|ing)?|mainnet|upgrade|hard\s*fork|softfork|airdrop)\b',
    r'\b(regulation|regulatory|compliance|approved|approval|licensed)\b',
    r'\b(billion|record\s*high|all.?time\s*high|ATH|milestone)\b',
    r'\b(layer\s*2|L2|rollup|zkEVM|scaling)\b',
    r'\b(Trump|Biden|Congress|parliament|legislation|policy)\b',
    r'\b(BlackRock|Fidelity|Goldman|JPMorgan|Morgan\s*Stanley)\b',
]

LOW_PATTERNS = [
    r'\b(update|patch|minor|maintenance|routine)\b',
    r'\b(reminder|newsletter|weekly|monthly|roundup|recap)\b',
    r'\b(tutorial|guide|how.?to|explainer|introduction)\b',
    r'\b(job|hiring|career|intern)\b',
]


def classify_text(title: str, content: str) -> str:
    text = f"{title} {content or ''}".lower()

    for pat in URGENT_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            return 'urgent'

    for pat in HIGH_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            return 'high'

    for pat in LOW_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            return 'low'

    return 'medium'


def classify_all(db_path: str, dry_run: bool = False, reclassify_all: bool = False) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    if reclassify_all:
        rows = conn.execute("SELECT id, title, content FROM hotspots").fetchall()
    else:
        rows = conn.execute(
            "SELECT id, title, content FROM hotspots WHERE importance = 'unanalyzed' OR importance IS NULL"
        ).fetchall()

    print(f"Classifying {len(rows)} articles...", file=sys.stderr)

    counts = {'urgent': 0, 'high': 0, 'medium': 0, 'low': 0}
    updates = []
    for row in rows:
        importance = classify_text(row['title'], row['content'] or '')
        counts[importance] += 1
        updates.append((importance, row['id']))

    if not dry_run:
        conn.executemany("UPDATE hotspots SET importance=? WHERE id=?", updates)
        conn.commit()
        print(f"✓ Classified {len(updates)} articles")
    else:
        print("[dry-run] Would update:")

    for level, cnt in counts.items():
        bar = '█' * (cnt // 5)
        print(f"  {level:8s} {cnt:4d}  {bar}")

    conn.close()


def main():
    p = argparse.ArgumentParser(description="Rule-based importance classifier")
    p.add_argument('--db', default=str(DB_PATH))
    p.add_argument('--dry-run', action='store_true', help='Preview without saving')
    p.add_argument('--all', dest='reclassify_all', action='store_true',
                   help='Re-classify all articles (not just unanalyzed)')
    args = p.parse_args()

    classify_all(args.db, dry_run=args.dry_run, reclassify_all=args.reclassify_all)


if __name__ == '__main__':
    main()
