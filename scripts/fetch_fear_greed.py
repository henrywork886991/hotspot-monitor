#!/usr/bin/env python3
"""
fetch_fear_greed.py — pull the Crypto Fear & Greed Index → data/fear_greed.json.

Free source: alternative.me (no key). The index (0-100) is a classic contrarian
signal: Extreme Fear ≈ 抄底區. The frontend reads the JSON server-side.

Usage:
  python fetch_fear_greed.py
"""

import sys
import json
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

_OUT = Path(config_loader.db_path()).parent / "fear_greed.json"


def _zh(value: int) -> str:
    if value < 25:  return "極度恐懼"
    if value < 45:  return "恐懼"
    if value <= 55: return "中性"
    if value < 75:  return "貪婪"
    return "極度貪婪"


def main() -> None:
    try:
        r = requests.get("https://api.alternative.me/fng/?limit=2",
                         headers={"Accept": "application/json"}, timeout=12)
        r.raise_for_status()
        data = r.json()["data"]
        cur = data[0]
        value = int(cur["value"])
        prev = int(data[1]["value"]) if len(data) > 1 else value
        out = {
            "value": value,
            "classification": cur.get("value_classification", ""),
            "label_zh": _zh(value),
            "prev": prev,
            "delta": value - prev,
            "updated": cur.get("timestamp", ""),
        }
        _OUT.write_text(json.dumps(out, ensure_ascii=False))
        print(f"Fear & Greed: {value} ({out['label_zh']}) → {_OUT}", file=sys.stderr)
    except Exception as e:
        print(f"[fear_greed] ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
