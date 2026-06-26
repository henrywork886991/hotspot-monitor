#!/usr/bin/env python3
"""
fetch_bydfi_symbols.py — build the list of coins tradeable on BYDFi.

Source: BYDFi's own sitemap (https://www.bydfi.com/maps/en.xml), which lists every
indexable spot trade page, e.g. https://www.bydfi.com/en/spot/BTC_USDT. We map each
base coin → its preferred pair (USDT first) so the frontend can deep-link to trade.

Output: data/bydfi_symbols.json  { "BTC": "BTC_USDT", "ETH": "ETH_USDT", ... }
Stable list — run weekly-ish, not every refresh.

Usage:
  python fetch_bydfi_symbols.py
"""

import re
import sys
import json
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

_SITEMAP = "https://www.bydfi.com/maps/en.xml"
_HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}
_QUOTE_PREF = ["USDT", "USDC", "USD", "BTC", "ETH"]   # which quote to deep-link

_OUT = Path(config_loader.db_path()).parent / "bydfi_symbols.json"


def build() -> dict[str, str]:
    r = requests.get(_SITEMAP, headers=_HEADERS, timeout=20)
    r.raise_for_status()
    pairs = re.findall(r"/en/spot/([A-Za-z0-9]+_[A-Za-z0-9]+)", r.text)

    by_base: dict[str, list[str]] = {}
    for pair in pairs:
        base, _, quote = pair.partition("_")
        by_base.setdefault(base.upper(), []).append(quote.upper())

    out: dict[str, str] = {}
    for base, quotes in by_base.items():
        quote = next((q for q in _QUOTE_PREF if q in quotes), quotes[0])
        out[base] = f"{base}_{quote}"
    return out


def main() -> None:
    symbols = build()
    _OUT.write_text(json.dumps(symbols, ensure_ascii=False, indent=0))
    print(f"Wrote {len(symbols)} tradeable coins → {_OUT}", file=sys.stderr)
    print("sample:", dict(list(symbols.items())[:8]), file=sys.stderr)


if __name__ == "__main__":
    main()
