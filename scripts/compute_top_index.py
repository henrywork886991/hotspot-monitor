#!/usr/bin/env python3
"""
compute_top_index.py — the BYDFi 逃頂指數 (Top Signal): our own composite "is it time
to take profit / de-risk?" signal, 0-100 (higher = hotter / closer to a cycle top).

This is the mirror of compute_dip_index.py, NOT its inverse: a market top has its own
canonical indicators (Pi Cycle, Mayer Multiple, Puell, MVRV-Z high, euphoric NUPL,
extreme greed, overheated funding) that are not just "100 − dip". Like Coinglass's
頂部信號 clipboard, we ALSO surface a checklist: how many of N signals have crossed
their top threshold (triggered_count / total).

Differentiator vs asksurf's Top Signal: those 12 are all quantitative (on-chain /
cycle / derivatives / flow). We add a dimension nobody else has — our news flow
(euphoria / ATH / FOMO chatter). That originality is what makes it AI-citable.

Components (weight, top threshold):
  • MVRV-Z      (18%)  BTC MVRV Z-Score ≥ 7        [bitcoin-data.com]   ← onchain
  • Pi Cycle    (15%)  111DMA / (2×350DMA) ≥ 1.0   [CoinGecko]          ← cycle
  • NUPL        (12%)  Net Unrealized P/L ≥ 0.75   [bitcoin-data.com]   ← onchain
  • Puell       (12%)  Puell Multiple ≥ 4.0        [bitcoin-data.com]   ← onchain
  • Mayer       (12%)  price / 200DMA ≥ 2.4        [CoinGecko]          ← cycle
  • 恐貪指數     (10%)  Fear & Greed ≥ 80           [alternative.me]     ← sentiment
  • 新聞狂熱     (10%)  share of ATH/FOMO headlines [our DB ← moat]      ← news
  • BTC 占有率   ( 6%)  dominance ≤ 45% (alt top)   [CoinGecko]          ← ordinal
  • 資金費率     ( 5%)  funding ≥ 0.05%/period      [Binance]            ← derivatives
Missing components are dropped and the remaining weights renormalized.

Output: data/top_index.json  + appends data/top_index_history.json
Usage:  python compute_top_index.py
"""

import re
import sys
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader
import compute_dip_index as dip            # reuse _bd_metric, _clamp, _HEADERS

_clamp = dip._clamp
_HEADERS = dip._HEADERS
_DATA = Path(config_loader.db_path()).parent
_OUT = _DATA / "top_index.json"
_HIST = _DATA / "top_index_history.json"

# Headlines signalling euphoria / a blow-off top (our exclusive signal).
_EUPHORIA_TERMS = re.compile(
    r"(all[\s-]?time high|record high|\bATH\b|new high|parabolic|moon|FOMO|euphori|"
    r"melt[\s-]?up|to the moon|breaks? \$|surge|soar|rally|新高|歷史新高|历史新高|"
    r"狂歡|狂欢|暴漲|暴涨|噴出|喷出|飆漲|飙涨|衝破|冲破|FOMO|瘋狂|疯狂|多殺空|多杀空|爆拉)",
    re.I,
)


def _btc_closes() -> list[float]:
    """365d of daily BTC closes — enough for 200DMA, 111DMA and 350DMA (Pi Cycle)."""
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart",
            params={"vs_currency": "usd", "days": 365, "interval": "daily"},
            headers=_HEADERS, timeout=15,
        )
        return [p[1] for p in r.json().get("prices", [])]
    except Exception:
        return []


def _sma(closes: list[float], n: int) -> float | None:
    return sum(closes[-n:]) / n if len(closes) >= n else None


def _dominance() -> float | None:
    try:
        r = requests.get("https://api.coingecko.com/api/v3/global", headers=_HEADERS, timeout=12)
        return float(r.json()["data"]["market_cap_percentage"]["btc"])
    except Exception:
        return None


def _funding_pct() -> float | None:
    """BTC perpetual funding rate as a percentage per 8h period (e.g. 0.01)."""
    try:
        r = requests.get("https://fapi.binance.com/fapi/v1/premiumIndex",
                         params={"symbol": "BTCUSDT"}, headers=_HEADERS, timeout=10)
        return float(r.json()["lastFundingRate"]) * 100
    except Exception:
        return None


def _fear_greed_raw() -> float | None:
    try:
        return float(json.loads((_DATA / "fear_greed.json").read_text())["value"])
    except Exception:
        return None


def _news_euphoria() -> tuple[float | None, int, int]:
    """Share of last-24h crypto headlines about ATH / FOMO / parabolic moves."""
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
        hot = sum(1 for t, s in rows if _EUPHORIA_TERMS.search(f"{t} {s}"))
        return hot / len(rows), hot, len(rows)
    except Exception:
        return None, 0, 0


def _label(v: float) -> tuple[str, str]:
    if v >= 75: return "強烈逃頂訊號", "extreme-distribution"
    if v >= 60: return "逃頂區間",     "distribution"
    if v >= 45: return "偏熱",         "warm"
    if v >= 30: return "中性",         "neutral"
    return "低位",                      "cheap"


def main() -> None:
    closes = _btc_closes()
    price = closes[-1] if closes else None
    ma200 = _sma(closes, 200)
    ma111 = _sma(closes, 111)
    ma350 = _sma(closes, 350)

    mvrvz = dip._bd_metric("mvrv-zscore")
    nupl = dip._bd_metric("nupl")
    puell = dip._bd_metric("puell-multiple")
    fg = _fear_greed_raw()
    funding = _funding_pct()
    dom = _dominance()
    news_ratio, hot_n, total_n = _news_euphoria()

    mayer = (price / ma200) if (price and ma200) else None
    picycle = (ma111 / (2 * ma350)) if (ma111 and ma350) else None

    def usd(x: float | None) -> str:
        return f"${x:,.0f}" if x else "—"

    # (key, name, category, weight, raw_value, threshold, direction, heat 0-100, value_disp, thr_disp, detail)
    raw = [
        ("mvrvz", "MVRV-Z", "鏈上", 18, mvrvz, 7.0, "gte",
         _clamp((mvrvz / 7) * 100) if mvrvz is not None else None,
         f"{mvrvz:.2f}" if mvrvz is not None else "—", "≥ 7.0",
         "市值/已實現市值 Z 分數，≥7 進入歷史頂部區"),
        ("picycle", "Pi Cycle 頂部", "週期", 15, picycle, 1.0, "gte",
         _clamp((picycle) * 100) if picycle is not None else None,
         f"{picycle:.3f}" if picycle is not None else "—", "≥ 1.000",
         f"111DMA {usd(ma111)} · 2×350DMA {usd(2*ma350) if ma350 else '—'}（上穿即觸）"),
        ("nupl", "NUPL 淨未實現盈虧", "鏈上", 12, nupl, 0.75, "gte",
         _clamp((nupl / 0.75) * 100) if nupl is not None else None,
         f"{nupl:.3f}" if nupl is not None else "—", "≥ 0.750",
         "淨未實現盈虧，>0.75 進入欣快區"),
        ("puell", "Puell Multiple", "鏈上", 12, puell, 4.0, "gte",
         _clamp((puell / 4) * 100) if puell is not None else None,
         f"{puell:.2f}" if puell is not None else "—", "≥ 4.00",
         "礦工日產值 / 365 日均值，>4 進入歷史頂部"),
        ("mayer", "Mayer Multiple", "週期", 12, mayer, 2.4, "gte",
         _clamp((mayer / 2.4) * 100) if mayer is not None else None,
         f"{mayer:.3f}" if mayer is not None else "—", "≥ 2.400",
         f"BTC 現價 {usd(price)} / 200日均線 {usd(ma200)}，>2.4 偏熱"),
        ("feargreed", "恐貪指數", "情緒", 10, fg, 80.0, "gte",
         _clamp(fg) if fg is not None else None,
         f"{fg:.0f}" if fg is not None else "—", "≥ 80",
         "0-100 綜合情緒，≥80 極度貪婪"),
        ("news", "新聞狂熱度（獨家）", "新聞", 10,
         (news_ratio * 100) if news_ratio is not None else None, 18.0, "gte",
         _clamp((news_ratio / 0.18) * 100) if news_ratio is not None else None,
         f"{news_ratio*100:.0f}%" if news_ratio is not None else "—", "≥ 18%",
         f"近24h 新高/FOMO 類新聞佔比（{hot_n}/{total_n}）"),
        ("dominance", "BTC 占有率反轉", "排名", 6, dom, 45.0, "lte",
         _clamp((60 - dom) / (60 - 45) * 100) if dom is not None else None,
         f"{dom:.1f}%" if dom is not None else "—", "≤ 45%",
         "BTC 占有率跌破 45% 多為山寨季頂峰前兆"),
        ("funding", "永續資金費率", "衍生品", 5, funding, 0.05, "gte",
         _clamp((funding / 0.05) * 100) if funding is not None else None,
         f"{funding:.4f}%" if funding is not None else "—", "≥ 0.05%",
         "BTC 永續資金費率，單期 ≥0.05% 多空過熱"),
    ]

    comps = [c for c in raw if c[7] is not None]
    if not comps:
        print("ERROR: no components available", file=sys.stderr)
        sys.exit(1)

    tw = sum(c[3] for c in comps)
    value = round(sum(c[7] * c[3] for c in comps) / tw)
    label, slug = _label(value)

    def triggered(rawval: float, thr: float, direction: str) -> bool:
        return rawval >= thr if direction == "gte" else rawval <= thr

    signals = []
    fired = 0
    for key, name, cat, w, rawval, thr, direction, heat, vdisp, tdisp, detail in comps:
        t = triggered(rawval, thr, direction)
        fired += int(t)
        signals.append({
            "key": key, "name": name, "category": cat,
            "weight": round(w / tw * 100), "heat": round(heat),
            "value": vdisp, "threshold": tdisp, "triggered": t, "detail": detail,
        })

    out = {
        "value": value,
        "label": label,
        "slug": slug,
        "triggered_count": fired,
        "total": len(comps),
        "signals": signals,
        "news_meta": {"hot_headlines": hot_n, "total_headlines": total_n},
        "btc_price": round(price) if price else None,
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

    print(f"BYDFi 逃頂指數: {value} ({label}) 觸發 {fired}/{len(comps)} "
          f"[{', '.join(f'{c[1]}:{round(c[7])}' for c in comps)}]", file=sys.stderr)


if __name__ == "__main__":
    main()
