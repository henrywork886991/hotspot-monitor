#!/usr/bin/env python3
"""
fetch_btc_history.py — bake a full BTC daily-close history → data/btc_daily.json.

Powers the "少虧多少 / 多賺多少" backtest. CoinGecko's free API only serves the
last 365 days, which would break every famous-top quick-pick (2021/2017/...), so
we pull the full series from Binance daily klines (free, no key, 2017-08 → now)
and cache it. Idempotent & incremental: only fetches days newer than the cache.

Usage:  python fetch_btc_history.py
"""

import sys
import json
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

_OUT = Path(config_loader.db_path()).parent / "btc_daily.json"
_HEADERS = {"User-Agent": "Mozilla/5.0"}
_GENESIS = datetime(2017, 8, 17, tzinfo=timezone.utc)


def main() -> None:
    try:
        data = json.loads(_OUT.read_text())
    except Exception:
        data = {}

    if data:
        last = max(data)
        start_dt = datetime.strptime(last, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
    else:
        start_dt = _GENESIS
    start = int(start_dt.timestamp() * 1000)
    now_ms = int(time.time() * 1000)

    added = 0
    while start < now_ms:
        try:
            r = requests.get(
                "https://api.binance.com/api/v3/klines",
                params={"symbol": "BTCUSDT", "interval": "1d", "startTime": start, "limit": 1000},
                headers=_HEADERS, timeout=20,
            )
            kl = r.json()
        except Exception as e:
            print(f"ERROR fetching klines: {e}", file=sys.stderr)
            break
        if not isinstance(kl, list) or not kl:
            break
        for k in kl:
            d = datetime.fromtimestamp(k[0] / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            if d not in data:
                data[d] = round(float(k[4]), 2)
                added += 1
        if len(kl) < 1000:
            break
        start = kl[-1][0] + 86_400_000
        time.sleep(0.2)

    _OUT.write_text(json.dumps(data, separators=(",", ":")))
    ks = sorted(data)
    print(f"btc_daily.json: {len(data)} days ({ks[0]} → {ks[-1]}), +{added} new", file=sys.stderr)


if __name__ == "__main__":
    main()
