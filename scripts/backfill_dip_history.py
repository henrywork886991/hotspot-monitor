#!/usr/bin/env python3
"""
backfill_dip_history.py — reconstruct ~90 days of the BYDFi 抄底指數 so the trend
chart is meaningful immediately. Uses the same primary sources as the live index
for the components that have history (sentiment + BTC technicals); funding / on-chain
/ news are omitted for past days and the remaining weights renormalized. Going
forward, compute_dip_index.py appends the full 8-signal value daily.

Run once (or to rebuild history):  python backfill_dip_history.py
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timezone

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

_HIST = Path(config_loader.db_path()).parent / "dip_index_history.json"
_H = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}
DAYS = 90


def _clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def _rsi(closes):
    if len(closes) < 15:
        return None
    gains = losses = 0.0
    for i in range(1, 15):
        d = closes[-i] - closes[-i - 1]
        if d >= 0: gains += d
        else: losses += -d
    ag, al = gains / 14, losses / 14
    return 100 if al == 0 else 100 - 100 / (1 + ag / al)


def main():
    # Fear & Greed history (date → value)
    fg = {}
    try:
        r = requests.get(f"https://api.alternative.me/fng/?limit={DAYS + 5}", headers=_H, timeout=15)
        for e in r.json()["data"]:
            d = datetime.fromtimestamp(int(e["timestamp"]), tz=timezone.utc).strftime("%Y-%m-%d")
            fg[d] = float(e["value"])
    except Exception as e:
        print(f"[fng] {e}", file=sys.stderr)

    # BTC daily closes (need 200 prior for the 200DMA) + current ATH
    r = requests.get("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart",
                     params={"vs_currency": "usd", "days": DAYS + 205, "interval": "daily"},
                     headers=_H, timeout=20)
    prices = r.json().get("prices", [])
    series = [(datetime.fromtimestamp(p[0] / 1000, tz=timezone.utc).strftime("%Y-%m-%d"), p[1]) for p in prices]
    ath = max(c for _, c in series) if series else None

    hist = []
    for i in range(len(series)):
        if i < 200:
            continue
        date, price = series[i]
        closes = [c for _, c in series[:i + 1]]
        comps = []  # (weight, score)
        if date in fg:
            comps.append((15, _clamp(100 - fg[date])))
        if ath:
            comps.append((15, _clamp((ath - price) / ath * 100)))
        ma200 = sum(closes[-200:]) / 200
        comps.append((15, _clamp(50 + (ma200 - price) / ma200 * 250)))
        rsi = _rsi(closes)
        if rsi is not None:
            comps.append((10, _clamp(100 - rsi)))
        tw = sum(w for w, _ in comps)
        if tw:
            hist.append({"date": date, "value": round(sum(s * w for w, s in comps) / tw)})

    hist = hist[-DAYS:]
    # Preserve today's full-index value if already computed
    try:
        existing = {h["date"]: h for h in json.loads(_HIST.read_text())}
        merged = {h["date"]: h for h in hist}
        merged.update(existing)            # existing (full-signal) wins for same day
        hist = sorted(merged.values(), key=lambda h: h["date"])[-120:]
    except Exception:
        pass

    _HIST.write_text(json.dumps(hist, ensure_ascii=False))
    vals = [h["value"] for h in hist]
    print(f"Backfilled {len(hist)} days · range {min(vals)}–{max(vals)} · latest {vals[-1]}", file=sys.stderr)


if __name__ == "__main__":
    main()
