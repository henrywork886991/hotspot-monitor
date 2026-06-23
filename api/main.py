#!/usr/bin/env python3
"""
api/main.py — read-only HTTP API for the crypto-news frontend (bydfi-ssr).

This is the "backend service" that decouples the frontend from the data: it reads
the same SQLite DB + data/*.json the pipeline produces and serves them as JSON,
so the Next.js frontend talks HTTP instead of reading the DB file directly. The
response shapes mirror the old lib/db.ts / lib/market-extras.ts contracts 1:1, so
the frontend's src/network layer maps straight across.

Run:  uvicorn api.main:app --host 0.0.0.0 --port 8900   (or: python api/main.py)
"""

import json
import re
import sqlite3
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import config_loader

_DB = config_loader.db_path()
_DATA = Path(_DB).parent

ALTCOIN_MAJORS = ["BTC", "ETH", "BNB", "SOL", "XRP", "TRX", "DOGE", "ADA", "USDT", "USDC"]
STABLE = {"USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "BUSD", "USD"}

app = FastAPI(title="BYDFi Crypto News API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten per env later
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(f"file:{_DB}?mode=ro", uri=True, timeout=15)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA busy_timeout=8000")
    return c


def _rows(cur) -> list[dict]:
    return [dict(r) for r in cur.fetchall()]


def _read_json(name: str, default):
    try:
        return json.loads((_DATA / name).read_text())
    except Exception:
        return default


# ---------------------------------------------------------------- news list

@app.get("/api/news/list")
def news_list(
    category: str = "all",
    importance: str = "all",
    keyword: str | None = None,
    page: int = 1,
    limit: int = Query(24, le=100),
    hours: int = 72,
):
    conds = ["fetched_at >= datetime('now', ?)"]
    params: list = [f"-{int(hours)} hours"]

    if category == "altcoin":
        conds.append("category IN ('crypto','cn_crypto','defi','web3')")
        conds.append("symbols IS NOT NULL AND symbols != ''")
        for m in ALTCOIN_MAJORS:
            conds.append("(',' || symbols) NOT LIKE ? ESCAPE '\\'")
            params.append(f"%,{m}\\_%")
    elif category and category != "all":
        conds.append("category = ?")
        params.append(category)
    else:
        conds.append("(category IS NULL OR category != 'markets')")

    if importance and importance != "all":
        conds.append("importance = ?")
        params.append(importance)
    if keyword:
        conds.append("(title LIKE ? OR summary LIKE ? OR keywords LIKE ?)")
        params += [f"%{keyword}%"] * 3
    conds.append("source != 'sopilot_twitter'")

    where = "WHERE " + " AND ".join(conds)
    order = ("(published_at IS NOT NULL AND published_at != '') DESC, "
             "published_at DESC, fetched_at DESC")
    offset = (page - 1) * limit

    with _conn() as c:
        total = c.execute(f"SELECT COUNT(DISTINCT title) AS cnt FROM hotspots {where}", params).fetchone()["cnt"]
        items = _rows(c.execute(
            f"""WITH ranked AS (
                  SELECT *, ROW_NUMBER() OVER (PARTITION BY title ORDER BY {order}, id DESC) AS rn
                  FROM hotspots {where}
                )
                SELECT * FROM ranked WHERE rn = 1
                ORDER BY {order} LIMIT ? OFFSET ?""",
            params + [limit, offset],
        ))
    return {"items": items, "total": total, "page": page, "limit": limit}


@app.get("/api/news/detail")
def news_detail(id: int):
    with _conn() as c:
        row = c.execute("SELECT * FROM hotspots WHERE id = ?", (id,)).fetchone()
        if not row:
            return {"item": None, "related": []}
        item = dict(row)
        related = _rows(c.execute(
            """SELECT * FROM hotspots
               WHERE category = ? AND id != ? AND category != 'markets'
               ORDER BY COALESCE(NULLIF(published_at,''), fetched_at) DESC LIMIT 6""",
            (item["category"], id),
        ))
    return {"item": item, "related": related}


@app.get("/api/news/by-coin")
def news_by_coin(base: str, limit: int = Query(40, le=100)):
    b = re.sub(r"[^A-Z0-9]", "", base.upper())
    like = f"%,{b}\\_%"
    with _conn() as c:
        items = _rows(c.execute(
            """SELECT * FROM hotspots
               WHERE symbols IS NOT NULL AND symbols != ''
                 AND (',' || symbols) LIKE ? ESCAPE '\\'
               ORDER BY COALESCE(NULLIF(published_at,''), fetched_at) DESC LIMIT ?""",
            (like, limit),
        ))
    pair = None
    for it in items:
        m = next((p.strip() for p in (it.get("symbols") or "").split(",")
                  if p.strip().upper().startswith(f"{b}_")), None)
        if m:
            pair = m
            break
    return {"items": items, "pair": pair}


@app.get("/api/markets")
def markets(source: str, limit: int = Query(12, le=50)):
    with _conn() as c:
        items = _rows(c.execute(
            "SELECT * FROM hotspots WHERE category='markets' AND source=? ORDER BY id ASC LIMIT ?",
            (source, limit),
        ))
    return {"items": items}


@app.get("/api/categories")
def categories():
    with _conn() as c:
        rows = _rows(c.execute(
            """SELECT category AS key, COUNT(*) AS count FROM hotspots
               WHERE fetched_at >= datetime('now','-72 hours')
               GROUP BY category ORDER BY count DESC"""))
        total = c.execute(
            "SELECT COUNT(*) AS cnt FROM hotspots WHERE fetched_at >= datetime('now','-72 hours')"
        ).fetchone()["cnt"]
    return {"categories": [{"key": "all", "count": total}, *rows]}


def _themed_news(terms: list[str], limit: int) -> list[dict]:
    like = " OR ".join(["(title LIKE ? OR summary LIKE ? OR keywords LIKE ?)"] * len(terms))
    params: list = []
    for t in terms:
        params += [f"%{t}%"] * 3
    with _conn() as c:
        return _rows(c.execute(
            f"""SELECT * FROM hotspots
                WHERE category IN ('crypto','cn_crypto','defi','macro') AND source != 'sopilot_twitter'
                  AND fetched_at >= datetime('now','-72 hours') AND ({like})
                GROUP BY title
                ORDER BY COALESCE(NULLIF(published_at,''), fetched_at) DESC LIMIT ?""",
            params + [limit],
        ))


@app.get("/api/dip-news")
def dip_news(limit: int = 12):
    return {"items": _themed_news(
        ['crash', 'plunge', 'selloff', 'sell-off', 'capitulat', 'liquidat', 'oversold',
         'buy the dip', 'dip', 'accumulat', 'bottom', 'tumble', 'slump',
         '暴跌', '崩盤', '崩盘', '抄底', '拋售', '抛售', '清算', '超賣', '增持', '逢低'], limit)}


@app.get("/api/top-news")
def top_news(limit: int = 12):
    return {"items": _themed_news(
        ['all-time high', 'record high', 'new high', 'ATH', 'parabolic', 'overheat',
         'euphoria', 'FOMO', 'surge', 'soar', 'rally', 'overbought', 'take profit',
         '新高', '歷史新高', '历史新高', '狂歡', '狂欢', '暴漲', '暴涨', '衝破', '冲破',
         '過熱', '过热', '獲利了結', '获利了结', '逃頂', '逃顶'], limit)}


@app.get("/api/hot-coins")
def hot_coins(limit: int = 60, altcoin_only: bool = False):
    exclude = (STABLE | set(ALTCOIN_MAJORS)) if altcoin_only else STABLE
    with _conn() as c:
        rows = _rows(c.execute(
            """SELECT symbols FROM hotspots
               WHERE symbols IS NOT NULL AND symbols != ''
                 AND fetched_at >= datetime('now','-72 hours')"""))
    counts: dict[str, dict] = {}
    for r in rows:
        for pair in (r["symbols"] or "").split(","):
            p = pair.strip()
            if not p:
                continue
            b = p.split("_")[0].upper()
            if b in exclude:
                continue
            if b in counts:
                counts[b]["count"] += 1
            else:
                counts[b] = {"base": b, "pair": p, "count": 1}
    out = sorted(counts.values(), key=lambda x: x["count"], reverse=True)[:limit]
    return {"coins": out}


# ---------------------------------------------------------------- indices / market extras

@app.get("/api/dip-index")
def dip_index():
    return _read_json("dip_index.json", None)


@app.get("/api/dip-index/history")
def dip_index_history():
    return _read_json("dip_index_history.json", [])


@app.get("/api/top-index")
def top_index():
    return _read_json("top_index.json", None)


@app.get("/api/top-index/history")
def top_index_history():
    return _read_json("top_index_history.json", [])


@app.get("/api/fear-greed")
def fear_greed():
    return _read_json("fear_greed.json", None)


@app.get("/api/coin-prices")
def coin_prices(bases: str = ""):
    data = _read_json("coin_prices.json", {})
    data.pop("_updated", None)
    wanted = [b.strip().upper() for b in bases.split(",") if b.strip()]
    if wanted:
        return {b: data.get(b) for b in wanted if data.get(b)}
    return data


# ---------------------------------------------------------------- backtest

@app.get("/api/backtest")
def backtest(date: str, amount: float, mode: str = "top"):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date) or amount <= 0:
        return {"error": "bad params"}
    daily = _read_json("btc_daily.json", {})
    p_then = daily.get(date)
    # "now" price: freshest coin price, else last daily close.
    prices = _read_json("coin_prices.json", {})
    p_now = (prices.get("BTC") or {}).get("price") if isinstance(prices.get("BTC"), dict) else None
    if not p_now and daily:
        p_now = daily[max(daily)]
    if not p_then or not p_now:
        return {"error": "price unavailable"}
    mode = "dip" if mode == "dip" else "top"
    btc = amount / p_then
    value_now = btc * p_now
    diff = (amount - value_now) if mode == "top" else (value_now - amount)
    pct = diff / amount * 100
    return {"mode": mode, "date": date, "amount": amount,
            "priceThen": p_then, "priceNow": p_now, "btc": btc,
            "valueNow": value_now, "diff": diff, "pct": pct}


@app.get("/api/sitemap-entries")
def sitemap_entries(limit: int = Query(2000, le=5000)):
    with _conn() as c:
        return {"entries": _rows(c.execute(
            """SELECT id, category, title, published_at, fetched_at FROM hotspots
               WHERE category != 'markets' AND fetched_at >= datetime('now','-72 hours')
               ORDER BY COALESCE(NULLIF(published_at,''), fetched_at) DESC LIMIT ?""",
            (limit,)))}


@app.get("/api/health")
def health():
    with _conn() as c:
        n = c.execute("SELECT COUNT(*) AS n FROM hotspots").fetchone()["n"]
    return {"ok": True, "rows": n}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8900)
