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


# ================================================================= CMS-compat
# Endpoints that mirror the existing BYDFi Java CMS contract
# (`/api/cms/public/frontend/hot-news/*`) so the already-shipped bydfi-ssr
# crypto-news pages can render OUR data with only a per-call baseURL override.
# Response envelope: { code, message, data }.  Item shape: HotNewsItem.

import datetime as _dt


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:80] or "news"


def _epoch_ms(s: str | None) -> int:
    if not s:
        return 0
    try:
        s2 = s.replace("Z", "+00:00")
        dt = _dt.datetime.fromisoformat(s2)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=_dt.timezone.utc)
        return int(dt.timestamp() * 1000)
    except Exception:
        return 0


def _coins_array(symbols: str | None) -> list[str]:
    out, seen = [], set()
    for p in (symbols or "").split(","):
        b = p.split("_")[0].strip().upper()
        if b and b not in seen:
            seen.add(b)
            out.append(b)
    return out


def _md_to_text(md: str | None) -> str:
    """Markdown → clean newline-separated paragraphs. The bydfi-ssr detail page
    splits content by \\n and renders each as a plain <p> (no markdown/HTML), so
    we strip ## headings, **bold**, and turn `- ` bullets into `• ` — otherwise
    the raw markdown symbols would show on the page."""
    if not md:
        return ""
    out: list[str] = []
    for line in md.replace("\r", "").split("\n"):
        s = line.strip()
        if not s:
            out.append("")
            continue
        s = re.sub(r"^#{1,6}\s+", "", s)             # ## 標題 → 標題
        s = re.sub(r"^\s*[-*]\s+", "• ", s)          # - 項目 → • 項目
        s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)     # **粗體** → 粗體
        s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", s)
        out.append(s)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()


def _first_para(text: str) -> str:
    for line in (text or "").split("\n"):
        s = line.strip()
        if s:
            return s
    return ""


def _to_hotnews_item(r: dict, lang: str = "zh") -> dict:
    # Language policy: zh-* → Traditional Chinese content; everything else → English.
    # We only generate zh + en; other locales fall back to en.
    en = not str(lang).lower().startswith("zh")
    if en:
        content = _md_to_text(r.get("article_md_en")) or _md_to_text(r.get("article_md")) \
            or r.get("fulltext") or r.get("content") or ""
        # Title must be in the SAME language as the body — fall back to the body's
        # lead before ever using the raw source title (avoids a Korean title on an
        # English/Chinese article).
        title = r.get("article_title_en") or r.get("article_title") \
            or _first_para(content) or r.get("title") or ""
        summary = _first_para(content) or r.get("summary") or ""
        score = r.get("article_score_en") or r.get("article_score") or 0
        lang_tag = "en_US"
    else:
        content = _md_to_text(r.get("article_md")) or r.get("fulltext") or r.get("content") or ""
        title = r.get("article_title") or _first_para(content) or r.get("title") or ""
        summary = r.get("summary_zh") or r.get("summary") or ""
        score = r.get("article_score") or 0
        lang_tag = "zh_tw"
    return {
        "id": str(r.get("id")),
        "title": title,
        "content": content,
        "summary": summary,
        "alias": f"{_slugify(title)}-{r.get('id')}",
        "coverImage": r.get("image_url") or "",
        "sourcePlatform": r.get("source") or "",
        "sourceUrl": r.get("url") or "",
        "author": r.get("source") or "",
        "profilePicture": "",
        "publishTime": _epoch_ms(r.get("published_at") or r.get("fetched_at")),
        "moduleCode": "crypto-news",
        "coins": _coins_array(r.get("symbols")),
        "keywords": r.get("keywords") or "",
        "aiScore": score,
        "viewCount": r.get("view_count") or 0,
        "likeCount": r.get("like_count") or 0,
        "lang": lang_tag,
        "translationStatus": 1,
    }


_CMS = "/api/cms/public/frontend/hot-news"


@app.get(_CMS + "/page")
def cms_hot_news_page(
    coin: str | None = None,
    keyword: str | None = None,
    order: str | None = None,
    moduleCode: str | None = None,
    sourcePlatform: str | None = None,
    page: int = 1,
    rows: int = Query(10, le=100),
    hours: int = 168,
    lang: str = "zh",
):
    conds = ["category != 'markets'", "source != 'sopilot_twitter'",
             "fetched_at >= datetime('now', ?)"]
    params: list = [f"-{int(hours)} hours"]
    # Only serve articles that already have the requested-language rewrite, so the
    # feed is never polluted with un-rewritten source-language (e.g. Korean) titles.
    if str(lang).lower().startswith("zh"):
        conds.append("article_title IS NOT NULL AND article_title != ''")
    else:
        conds.append("article_title_en IS NOT NULL AND article_title_en != ''")
    if coin and coin.lower() != "all":
        b = re.sub(r"[^A-Z0-9]", "", coin.upper())
        conds.append("(',' || symbols) LIKE ? ESCAPE '\\'")
        params.append(f"%,{b}\\_%")
    if keyword:
        conds.append("(title LIKE ? OR summary LIKE ? OR keywords LIKE ?)")
        params += [f"%{keyword}%"] * 3
    where = "WHERE " + " AND ".join(conds)
    # We have no view_count column (Java-only); use AI score as the popularity proxy.
    order_sql = ("COALESCE(article_score,0) DESC, " if order == "view_count_desc" else "") + \
        "(published_at IS NOT NULL AND published_at != '') DESC, published_at DESC, fetched_at DESC"
    offset = (page - 1) * rows
    with _conn() as c:
        total = c.execute(f"SELECT COUNT(DISTINCT title) AS cnt FROM hotspots {where}", params).fetchone()["cnt"]
        items = _rows(c.execute(
            f"""WITH ranked AS (
                  SELECT *, ROW_NUMBER() OVER (PARTITION BY title ORDER BY {order_sql}, id DESC) AS rn
                  FROM hotspots {where}
                ) SELECT * FROM ranked WHERE rn = 1 ORDER BY {order_sql} LIMIT ? OFFSET ?""",
            params + [rows, offset]))
    return {"code": 200, "message": "", "data": {"list": [_to_hotnews_item(r, lang) for r in items], "total": total}}


@app.get(_CMS + "/detail")
def cms_hot_news_detail(id: str | None = None, alias: str | None = None, lang: str = "zh"):
    rid = None
    if id and id.isdigit():
        rid = int(id)
    elif alias:
        m = re.search(r"-(\d+)$", alias)
        rid = int(m.group(1)) if m else None
    if rid is None:
        return {"code": 200, "message": "", "data": None}
    with _conn() as c:
        row = c.execute("SELECT * FROM hotspots WHERE id = ?", (rid,)).fetchone()
    return {"code": 200, "message": "", "data": _to_hotnews_item(dict(row), lang) if row else None}


@app.get(_CMS + "/coins")
def cms_hot_news_coins(moduleCode: str | None = None, sourcePlatform: str | None = None):
    # Coin tabs: most-mentioned bases in the live window (excl. stablecoins).
    data = hot_coins(limit=12)["coins"]
    return {"code": 200, "message": "", "data": [c["base"] for c in data]}


@app.get(_CMS + "/like/increment")
def cms_hot_news_like(id: str | None = None):
    return {"code": 200, "message": "", "data": True}


@app.get("/api/health")
def health():
    with _conn() as c:
        n = c.execute("SELECT COUNT(*) AS n FROM hotspots").fetchone()["n"]
    return {"ok": True, "rows": n}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8900)
