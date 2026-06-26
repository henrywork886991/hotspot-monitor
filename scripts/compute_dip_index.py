#!/usr/bin/env python3
"""
compute_dip_index.py — the BYDFi 抄底指數 (Dip Index): our own composite "is it a
good time to accumulate?" signal, 0-100 (higher = stronger dip/oversold/fear).

Unlike re-displaying someone else's Fear & Greed, this aggregates MULTIPLE sources
into one named metric we own — and adds a dimension nobody else has: our news flow
(capitulation chatter). That originality is what makes it rankable & AI-citable.

Components (transparent, checklist-style like Coinglass's peak signals):
  • 市場情緒  (30%)  100 − Fear&Greed                         [alternative.me]
  • 回調幅度  (25%)  BTC drawdown from all-time high           [CoinGecko]
  • 超賣 RSI   (20%)  100 − BTC 14d RSI                         [CoinGecko]
  • 資金費率  (10%)  negative funding ⇒ higher                 [Binance]
  • 新聞恐慌  (15%)  share of crypto headlines about crash/    [our DB ← moat]
                     selloff/liquidation in the last 24h
Missing components are dropped and the remaining weights renormalized.

Output: data/dip_index.json  + appends data/dip_index_history.json
Usage:  python compute_dip_index.py
"""

import re
import sys
import json
import time
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

_DATA = Path(config_loader.db_path()).parent
_OUT = _DATA / "dip_index.json"
_HIST = _DATA / "dip_index_history.json"
_HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}

_FEAR_TERMS = re.compile(
    r"(crash|plunge|sell[\s-]?off|selloff|liquidat|capitulat|dump|tumbl|slump|"
    r"bear market|below \$|drop|fall|sink|暴跌|崩盤|崩盘|拋售|抛售|跳水|大跌|爆倉|爆仓|清算|恐慌)",
    re.I,
)


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _fear_greed() -> float | None:
    try:
        v = json.loads((_DATA / "fear_greed.json").read_text())["value"]
        return _clamp(100 - float(v))            # extreme fear → high dip score
    except Exception:
        return None


def _btc_signals() -> tuple[float | None, float | None, float | None]:
    """BTC drawdown from ATH, 14-day RSI, and 200-day MA deviation — from CoinGecko.
    The 200DMA / MVRV / cost-basis family are the classic bottom signals (cf.
    btc.seanzhao.ai, Glassnode); 200DMA is the one we can get free."""
    draw = rsi = ma = None
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/coins/markets",
            params={"vs_currency": "usd", "ids": "bitcoin"},
            headers=_HEADERS, timeout=12,
        )
        athc = r.json()[0].get("ath_change_percentage")
        if athc is not None:
            draw = _clamp(abs(float(athc)))      # -55% from ATH → 55
    except Exception:
        pass
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart",
            params={"vs_currency": "usd", "days": 210, "interval": "daily"},
            headers=_HEADERS, timeout=15,
        )
        closes = [p[1] for p in r.json().get("prices", [])]
        if len(closes) >= 15:
            gains, losses = [], []
            for i in range(1, 15):
                d = closes[-i] - closes[-i - 1]
                (gains if d >= 0 else losses).append(abs(d))
            ag = sum(gains) / 14
            al = sum(losses) / 14
            rsi_val = 100 if al == 0 else 100 - 100 / (1 + ag / al)
            rsi = _clamp(100 - rsi_val)           # oversold (low RSI) → high dip score
        if len(closes) >= 200:
            ma200 = sum(closes[-200:]) / 200
            dev = (ma200 - closes[-1]) / ma200    # price below 200DMA → positive
            ma = _clamp(50 + dev * 250)           # 20% below 200DMA → 100
    except Exception:
        pass
    return draw, rsi, ma


def _funding() -> float | None:
    try:
        r = requests.get("https://fapi.binance.com/fapi/v1/premiumIndex",
                         params={"symbol": "BTCUSDT"}, headers=_HEADERS, timeout=10)
        rate = float(r.json()["lastFundingRate"])   # e.g. 0.0001 = 0.01%
        # neutral≈0 → 50; strongly negative funding (shorts pay) → toward 100
        return _clamp(50 - rate * 50000)
    except Exception:
        return None


def _bd_metric(path: str) -> float | None:
    """Latest value of a bitcoin-data.com on-chain metric (Glassnode-equivalent, free)."""
    try:
        r = requests.get(f"https://bitcoin-data.com/v1/{path}/last", headers=_HEADERS, timeout=12)
        d = r.json()
        if not isinstance(d, dict) or "error" in d:
            return None
        for k, v in d.items():
            if k.lower() in ("d", "date", "unixts", "theday"):
                continue
            try:
                return float(v)
            except (TypeError, ValueError):
                continue
    except Exception:
        pass
    return None


def _onchain() -> tuple[float | None, float | None]:
    """On-chain valuation signals: MVRV Z-Score + NUPL. Daily metrics → cached ~12h
    (also shields us from the free tier's hourly rate limit)."""
    cache_path = _DATA / "onchain.json"
    try:
        cache = json.loads(cache_path.read_text())
    except Exception:
        cache = {}
    fresh = cache and (time.time() - cache.get("ts", 0) < 12 * 3600)
    mvrvz = cache.get("mvrvz")
    nupl = cache.get("nupl")
    if not fresh:
        m = _bd_metric("mvrv-zscore")
        n = _bd_metric("nupl")
        if m is not None: mvrvz = m
        if n is not None: nupl = n
        if mvrvz is not None or nupl is not None:
            cache_path.write_text(json.dumps({"mvrvz": mvrvz, "nupl": nupl, "ts": time.time()}))
    # MVRV-Z: ~0 = generational bottom, ~3.5 = mean, >7 = top → invert to dip score
    mvrv_score = _clamp(100 - mvrvz * 14) if mvrvz is not None else None
    # NUPL: <0 capitulation, ~0.5 belief/euphoria → invert
    nupl_score = _clamp(50 - nupl * 100) if nupl is not None else None
    return mvrv_score, nupl_score


def _news_fear() -> tuple[float | None, int, int]:
    try:
        conn = sqlite3.connect(config_loader.db_path())
        rows = conn.execute(
            """SELECT title, COALESCE(summary,'') FROM hotspots
               WHERE category IN ('crypto','cn_crypto','defi')
                 AND fetched_at >= datetime('now','-24 hours')"""
        ).fetchall()
        conn.close()
        if len(rows) < 10:
            return None, 0, 0
        fear = sum(1 for t, s in rows if _FEAR_TERMS.search(f"{t} {s}"))
        ratio = fear / len(rows)
        # 0% fear→0, ~35%+ of headlines about crashes → 100
        return _clamp(ratio * 285), fear, len(rows)
    except Exception:
        return None, 0, 0


def _label(v: float) -> tuple[str, str]:
    if v >= 75: return "強烈抄底訊號", "extreme-accumulation"
    if v >= 60: return "抄底區間",     "accumulation"
    if v >= 45: return "中性偏弱",     "neutral"
    if v >= 30: return "偏熱",         "warm"
    return "市場貪婪",                  "greed"


def main() -> None:
    fg = _fear_greed()
    draw, rsi, ma = _btc_signals()
    fund = _funding()
    mvrv, nupl = _onchain()
    news, fear_n, total_n = _news_fear()

    raw = [
        ("MVRV-Z",   "BTC MVRV Z-Score（鏈上估值）",   18, mvrv),
        ("市場情緒", "100 − 恐懼貪婪指數",             15, fg),
        ("回調幅度", "BTC 距歷史高點跌幅",             15, draw),
        ("200日均線", "BTC 價格相對 200 日均線",       15, ma),
        ("NUPL",     "淨未實現損益（鏈上投降度）",     12, nupl),
        ("超賣 RSI", "100 − BTC 14日 RSI",             10, rsi),
        ("新聞恐慌", "近24h 崩跌類新聞佔比（獨家）",    10, news),
        ("資金費率", "永續資金費率（負值偏多）",        5, fund),
    ]
    comps = [(n, d, w, v) for (n, d, w, v) in raw if v is not None]
    if not comps:
        print("ERROR: no components available", file=sys.stderr)
        sys.exit(1)

    tw = sum(w for _, _, w, _ in comps)
    value = round(sum(v * w for _, _, w, v in comps) / tw)
    label, slug = _label(value)

    out = {
        "value": value,
        "label": label,
        "slug": slug,
        "components": [
            {"name": n, "desc": d, "weight": round(w / tw * 100), "score": round(v)}
            for (n, d, w, v) in comps
        ],
        "news_meta": {"fear_headlines": fear_n, "total_headlines": total_n},
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    _OUT.write_text(json.dumps(out, ensure_ascii=False))

    # Append daily history (one point per UTC day; keep ~120).
    try:
        hist = json.loads(_HIST.read_text()) if _HIST.exists() else []
    except Exception:
        hist = []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    hist = [h for h in hist if h.get("date") != today]
    hist.append({"date": today, "value": value})
    _HIST.write_text(json.dumps(hist[-120:], ensure_ascii=False))

    print(f"BYDFi 抄底指數: {value} ({label}) "
          f"[{', '.join(f'{n}:{round(v)}' for n,_,_,v in comps)}]", file=sys.stderr)


if __name__ == "__main__":
    main()
