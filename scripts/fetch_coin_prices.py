#!/usr/bin/env python3
"""
fetch_coin_prices.py — cache current price + 24h change for the coin hub pages.

Source: CoinGecko `/coins/markets` (top coins by market cap). BYDFi's own market
API sits behind a Cloudflare bot challenge and isn't callable from here, so — as
with the 行情 section — CoinGecko is the price source.

We keep the highest-market-cap coin per ticker (CoinGecko has many tickers that
collide, e.g. several "BTC"); since the response is market_cap_desc, the first
occurrence wins. Output is keyed by base symbol so the frontend can look up a
price by /coin/<BASE>.

Output: data/coin_prices.json
  { "_updated": "2026-06-09T...Z",
    "BTC": { "price": 65432.1, "pct24h": 2.34, "name": "Bitcoin", "rank": 1 }, ... }

Stable-ish display data — run on each refresh (prices drift, but a ~hourly cron
is plenty for an SEO content page).

Usage:
  python fetch_coin_prices.py [--pages 2]
"""

import sys
import json
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

_OUT = Path(config_loader.db_path()).parent / "coin_prices.json"
_URL = "https://api.coingecko.com/api/v3/coins/markets"


def build(pages: int = 2) -> dict:
    out: dict[str, dict] = {}
    for page in range(1, pages + 1):
        resp = requests.get(
            _URL,
            params={"vs_currency": "usd", "order": "market_cap_desc",
                    "per_page": 250, "page": page, "price_change_percentage": "24h"},
            headers={"Accept": "application/json"}, timeout=15,
        )
        resp.raise_for_status()
        for c in resp.json():
            base = (c.get("symbol") or "").upper().strip()
            price = c.get("current_price")
            if not base or base in out or price is None:
                continue  # first (highest-mcap) ticker wins
            chg = c.get("price_change_percentage_24h")
            out[base] = {
                "price": price,
                "pct24h": round(float(chg), 2) if chg is not None else None,
                "name": c.get("name", ""),
                "rank": c.get("market_cap_rank"),
            }
        time.sleep(1.2)  # be gentle with CoinGecko's public rate limit
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=2, help="CoinGecko pages of 250 (default 2 = top 500)")
    args = ap.parse_args()

    coins = build(args.pages)
    payload = {"_updated": datetime.now(timezone.utc).isoformat(), **coins}
    _OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    print(f"Wrote {len(coins)} coin prices → {_OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
