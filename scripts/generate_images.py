#!/usr/bin/env python3
"""
generate_images.py — Generate original cover images for *new* articles that still
have no image, and upload them to Cloudinary.

This is the L2 "quality" layer on top of the CSS CoverFallback (which already
guarantees no card is ever blank). It only ever touches FRESH articles — by
default rows fetched in the last 2 days — so the ~3000-row historical backlog
keeps its CSS cover and never costs an API call. Each row is attempted at most
once (img_gen_tried flag), so failures don't retry forever.

Safety: we deliberately DO NOT feed the (often sensational) headline to the
image model — that risks fabricating photoreal "news event" imagery. Instead we
build an abstract editorial-illustration prompt from category + coin tickers +
ASCII keywords, and forbid text / real faces / brand logos in the prompt.

Image backend is any OpenAI-compatible /chat/completions endpoint that returns a
generated image (e.g. gemini-3.1-flash-image-preview via an aggregator) — same
API shape as the DeepSeek text stage.

Env (e.g. from a gitignored .env):
  IMAGE_API_KEY           (required) key for the image provider
  IMAGE_API_BASE          (required) e.g. https://<provider>/v1
  IMAGE_MODEL             default gemini-3.1-flash-image-preview
  CLOUDINARY_URL          (required) cloudinary://<api_key>:<api_secret>@<cloud_name>
  CLOUDINARY_FOLDER       default covers   (folder/public_id prefix)

Usage:
  python generate_images.py                 # up to 40 fresh imageless articles
  python generate_images.py --limit 10
  python generate_images.py --days 7        # widen the "new" window
  python generate_images.py --dry-run       # show prompts, no API/upload
"""

import os
import re
import sys
import base64
import hashlib
import argparse
import sqlite3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

DEFAULT_DB = config_loader.db_path()

_API_KEY  = os.environ.get("IMAGE_API_KEY", "")
_API_BASE = os.environ.get("IMAGE_API_BASE", "").rstrip("/")
_MODEL    = os.environ.get("IMAGE_MODEL", "gemini-3.1-flash-image-preview")

# The image is built to (a) RELATE to the article — its coin tickers and extracted
# keywords go into the prompt — and (b) look like a REAL press/stock photo, not an
# AI render. So: grounded real-world subjects only (NO glowing networks, holograms,
# neon circuits or abstract 3D — those are the "AI/sci-fi" tells), varied by a hash
# of the article id, with the style line hard-banning render/illustration looks.

# Tickers we can name so the model renders a recognisable coin; others stay generic.
_COIN_NAMES = {
    "BTC": "Bitcoin", "ETH": "Ethereum", "SOL": "Solana", "XRP": "XRP", "BNB": "BNB",
    "DOGE": "Dogecoin", "ADA": "Cardano", "TRX": "TRON", "TON": "Toncoin",
    "AVAX": "Avalanche", "LINK": "Chainlink", "DOT": "Polkadot", "LTC": "Litecoin",
    "SHIB": "Shiba Inu", "MATIC": "Polygon", "UNI": "Uniswap", "ATOM": "Cosmos",
    "XLM": "Stellar", "BCH": "Bitcoin Cash", "HYPE": "Hyperliquid", "SUI": "Sui",
}

# Subject SCENES per category — varied so the feed isn't all "coins on a table".
# Crypto scenes use {coin} = the article's lead coin name.
_CAT_SCENES = {
    "crypto": [
        "{coin} coins scattered across a rustic wooden table",
        "a towering stack of {coin} coins on a marble desk",
        "a giant {coin} coin standing like a monument in a city square",
        "a stylized bull and bear locked in a dramatic face-off",
        "a rocket shaped like a coin soaring past a skyline",
        "an ornate bank vault bursting open with gold coins",
        "a hand holding a phone running a crypto trading app",
        "a workbench lined with mining-rig graphics cards",
        "a price chart drawn as a dramatic mountain range",
        "a treasure chest overflowing with {coin} coins",
    ],
    "stocks": [
        "a screen full of candlestick stock charts",
        "a bustling trading floor seen from above",
        "a financial newspaper, reading glasses and a coffee cup",
        "glass office towers soaring against the sky",
        "a brass bull and bear statue facing off on a desk",
        "an electronic ticker board of share prices",
    ],
    "macro": [
        "a vintage globe surrounded by world banknotes",
        "a grand central-bank building with classical columns",
        "an aerial view of a busy container shipping port",
        "gold bars stacked on a dark surface",
        "a currency-exchange counter with a rate board",
        "a cargo ship crossing the ocean at dawn",
    ],
    "tech": [
        "a close-up of a colourful computer circuit board",
        "a corridor of humming server racks",
        "a laptop covered in lines of code on a desk",
        "a robot arm on an assembly line",
        "an engineer's bench scattered with gadgets",
        "a satellite orbiting above the earth",
    ],
    "regulation": [
        "brass scales of justice on a desk",
        "a classical courthouse with tall columns",
        "a wooden gavel resting on its block",
        "stacks of legal documents and a fountain pen",
        "a domed government building",
    ],
    "asia": [
        "a dazzling Asian city skyline at dusk",
        "a lively Asian night-market street",
        "an aerial view of a dense Asian metropolis",
        "a harbour ringed by skyscrapers in an Asian financial hub",
    ],
}
_CAT_SCENES["cn_crypto"] = _CAT_SCENES["crypto"]
_CAT_SCENES["defi"] = _CAT_SCENES["crypto"]
_CAT_SCENES["web3"] = _CAT_SCENES["crypto"]

# Art-style templates — ONE picked per article (hashed), so the feed mixes
# hand-drawn / cartoon / anime / retro / watercolour / pop-art / etc.
_STYLES = [
    "a hand-drawn ink-and-watercolour illustration with loose expressive lines",
    "a bold flat-vector editorial illustration with clean shapes and vivid colours",
    "a friendly cartoon comic illustration with bold outlines, bright and playful",
    "a Japanese anime-style illustration with crisp cel shading and vivid colour",
    "a retro 1970s vintage-poster illustration with a warm muted screen-print look",
    "a lively digital painting with dynamic visible brushstrokes",
    "a soft watercolour illustration with gentle washes and bleeds",
    "a papercut layered-paper collage illustration with bright colours",
    "a pop-art comic illustration with halftone dots and bold saturated colour",
    "a clean isometric illustration with modern shapes and soft gradients",
]

_COMPOSITIONS = [
    "a dynamic close-up filling the frame",
    "a balanced wide establishing view",
    "a bold low-angle hero composition",
    "an off-center rule-of-thirds framing with negative space",
    "a lively top-down view",
    "an energetic diagonal composition",
]
_MOODS = [
    "warm golden tones",
    "a cool fresh palette",
    "bright high-energy colours",
    "a soft pastel palette",
    "rich dramatic contrast",
    "vibrant sunset colours",
]

_BANS = "No text, no lettering, no signage, no watermark. 16:9."


def _pick(options: list[str], seed: str) -> str:
    """Deterministic per-article choice — varied across articles, reproducible."""
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    return options[h % len(options)]


def _build_prompt(article_id: int, category: str | None,
                  symbols: str | None, keywords: str | None) -> str:
    cat = category if category in _CAT_SCENES else "stocks"
    coins = [s.split("_")[0].strip().upper()
             for s in (symbols or "").split(",") if s.strip()][:2]
    coin_name = _COIN_NAMES.get(coins[0], "cryptocurrency") if coins else "cryptocurrency"

    scene = _pick(_CAT_SCENES[cat], f"{article_id}-scene-{cat}").replace("{coin}", coin_name)

    # ASCII coins/keywords carry the article's topic into the image (CJK renders
    # as garbled text, so it's dropped).
    kws = [k.strip() for k in (keywords or "").split(",")]
    kws = [k for k in kws if k and re.fullmatch(r"[A-Za-z0-9 .&/+-]+", k)]
    rel_terms = (coins + kws)[:3]
    rel = f", themed around {', '.join(rel_terms)}" if rel_terms else ""

    style = _pick(_STYLES, f"{article_id}-style")
    comp = _pick(_COMPOSITIONS, f"{article_id}-comp")
    mood = _pick(_MOODS, f"{article_id}-mood")
    return f"{style[0].upper() + style[1:]} depicting {scene}{rel}, {comp}, {mood}. {_BANS}"


_DATA_URL = re.compile(r"data:image/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)")
_HTTP_IMG = re.compile(r"https?://[^\s\"')]+\.(?:png|jpe?g|webp)", re.I)


def _img_bytes_from_url(url: str) -> bytes | None:
    if url.startswith("data:"):
        m = _DATA_URL.search(url)
        return base64.b64decode(re.sub(r"\s", "", m.group(1))) if m else None
    try:
        r = requests.get(url, timeout=30)
        return r.content if r.status_code == 200 else None
    except Exception:
        return None


def _extract_image(msg: dict) -> bytes | None:
    """Pull image bytes out of an OpenAI-compatible chat message, tolerating the
    several shapes proxies use (images[], multimodal content[], or a data/URL
    embedded in the text content)."""
    # 1) message.images: [{image_url:{url}} | {url} | "data:..."]
    for it in msg.get("images") or []:
        url = it if isinstance(it, str) else (
            (it.get("image_url") or {}).get("url") if isinstance(it.get("image_url"), dict)
            else it.get("url") or it.get("image_url") or it.get("b64_json"))
        if url:
            b = _img_bytes_from_url(url if str(url).startswith(("http", "data:"))
                                    else f"data:image/png;base64,{url}")
            if b:
                return b
    # 2) message.content as a multimodal parts array
    content = msg.get("content")
    if isinstance(content, list):
        for part in content:
            if not isinstance(part, dict):
                continue
            url = ((part.get("image_url") or {}).get("url")
                   if isinstance(part.get("image_url"), dict) else part.get("image_url"))
            if url and (b := _img_bytes_from_url(url)):
                return b
        content = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
    # 3) content as text holding a data URL or http image link
    if isinstance(content, str) and content:
        m = _DATA_URL.search(content)
        if m:
            return base64.b64decode(re.sub(r"\s", "", m.group(1)))
        h = _HTTP_IMG.search(content)
        if h:
            return _img_bytes_from_url(h.group(0))
    return None


class _TransientError(Exception):
    """A failure that is NOT the article's fault (billing, rate limit, network,
    5xx). The row must keep img_gen_tried=0 so it retries on a later run."""


# Set once we hit a billing/rate block so the rest of the batch stops calling the
# API (avoids a 429 lockout) and is left for the next run.
_API_BLOCKED = False


def _generate(prompt: str, timeout: int = 120) -> bytes | None:
    """Call an OpenAI-compatible chat/completions image model; return PNG/JPEG bytes.

    Raises _TransientError on billing/rate/server/network failures (don't burn the
    one-shot flag). Returns None only when the request succeeded but produced no
    usable image (a genuine, per-article failure)."""
    global _API_BLOCKED
    if _API_BLOCKED:
        raise _TransientError("API blocked earlier this run")
    try:
        r = requests.post(
            f"{_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {_API_KEY}", "Content-Type": "application/json"},
            json={"model": _MODEL, "messages": [{"role": "user", "content": prompt}]},
            timeout=timeout,
        )
    except Exception as e:
        raise _TransientError(f"network: {e}")

    if r.status_code in (402, 429):
        _API_BLOCKED = True   # insufficient balance / rate limited — stop the batch
        raise _TransientError(f"{r.status_code} {r.text[:140]}")
    if r.status_code >= 500:
        raise _TransientError(f"server {r.status_code}")
    if r.status_code != 200:
        print(f"  [gen-err] {r.status_code} {r.text[:200]}", file=sys.stderr)
        return None   # other 4xx (e.g. bad request) — treat as a per-article failure

    msg = (r.json().get("choices") or [{}])[0].get("message") or {}
    data = _extract_image(msg)
    if not data:
        print(f"  [gen-noimg] {str(msg)[:200]}", file=sys.stderr)
    return data


# --- Cloudinary upload ------------------------------------------------------

def _cloudinary_ready() -> None:
    import cloudinary  # lazy import so --dry-run doesn't need the SDK
    cloudinary.config(secure=True)  # reads CLOUDINARY_URL from env


def _upload(data: bytes, public_id: str) -> str:
    import cloudinary.uploader
    from io import BytesIO
    res = cloudinary.uploader.upload(
        BytesIO(data),
        public_id=public_id,
        overwrite=True,
        resource_type="image",
        format="png",
    )
    # Deliver via f_auto,q_auto — Cloudinary serves WebP/AVIF at auto quality
    # (~80%+ smaller than the raw PNG), to keep LCP fast.
    return res["secure_url"].replace("/upload/", "/upload/f_auto,q_auto/", 1)


def _ensure_cols(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    if "image_url" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN image_url TEXT")
    if "img_generated" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN img_generated INTEGER DEFAULT 0")
    if "img_gen_tried" not in cols:
        conn.execute("ALTER TABLE hotspots ADD COLUMN img_gen_tried INTEGER DEFAULT 0")
    conn.commit()


def _check_env(dry_run: bool) -> None:
    missing = [k for k in ("IMAGE_API_KEY", "IMAGE_API_BASE") if not os.environ.get(k)]
    if not dry_run and not os.environ.get("CLOUDINARY_URL"):
        missing.append("CLOUDINARY_URL")
    if missing:
        print("ERROR: missing env: " + ", ".join(missing) + " (source your .env).",
              file=sys.stderr)
        sys.exit(1)


def run(db_path: str, limit: int, days: int, workers: int,
        prefix: str, dry_run: bool) -> None:
    _check_env(dry_run)

    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    # WAL lets the frontend keep reading while we write; busy_timeout waits out
    # any brief lock instead of erroring with "database is locked".
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    _ensure_cols(conn)

    rows = conn.execute(
        """
        SELECT id, category, symbols, keywords, title
        FROM hotspots
        WHERE (image_url IS NULL OR image_url = '')
          AND (img_gen_tried IS NULL OR img_gen_tried = 0)
          AND (category IS NULL OR category != 'markets')
          -- Only articles that will actually publish as a grid card: AI-rewritten
          -- ones still missing an image. Thin (never-rewritten) items live in the
          -- flash list only and never need a generated cover — saves spend.
          AND article_md IS NOT NULL AND article_md != ''
          AND COALESCE(NULLIF(fetched_at, ''), '') >= datetime('now', ?)
        ORDER BY (importance IN ('urgent','high')) DESC,
                 COALESCE(NULLIF(published_at, ''), fetched_at) DESC
        LIMIT ?
        """,
        (f"-{days} days", limit),
    ).fetchall()
    print(f"Fresh imageless articles to generate: {len(rows)}", file=sys.stderr)
    if not rows:
        conn.close()
        return

    if dry_run:
        for r in rows:
            print(f"\n[{r['id']}] {(r['title'] or '')[:60]}")
            print("  PROMPT:", _build_prompt(r["id"], r["category"], r["symbols"], r["keywords"]))
        conn.close()
        return

    _cloudinary_ready()

    # status: "ok" | "fail" (permanent — mark tried) | "skip" (transient — retry later)
    def work(row):
        prompt = _build_prompt(row["id"], row["category"], row["symbols"], row["keywords"])
        try:
            data = _generate(prompt)
        except _TransientError as e:
            return row["id"], None, "skip", str(e)
        if not data:
            return row["id"], None, "fail", None
        try:
            url = _upload(data, f"{prefix}/{row['id']}")
        except Exception as e:
            return row["id"], None, "skip", f"upload: {e}"   # storage hiccup → retry
        return row["id"], url, "ok", None

    ok = failed = skipped = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for rid, url, status, note in pool.map(work, rows):
            if status == "ok":
                conn.execute(
                    "UPDATE hotspots SET image_url=?, img_generated=1, "
                    "img_checked=1, img_gen_tried=1 WHERE id=?", (url, rid))
                ok += 1
                print(f"  [OK ] id={rid} {url}", file=sys.stderr)
            elif status == "fail":
                # Genuine per-article failure — mark tried so we don't keep paying.
                conn.execute("UPDATE hotspots SET img_gen_tried=1 WHERE id=?", (rid,))
                failed += 1
            else:
                skipped += 1   # transient: leave img_gen_tried=0 to retry next run
                if note:
                    print(f"  [skip] id={rid} {note[:120]}", file=sys.stderr)
            conn.commit()
    conn.close()
    print(f"\nDone — generated {ok} | failed {failed} | skipped {skipped}", file=sys.stderr)
    if _API_BLOCKED:
        print("  ⚠ image API blocked (billing/rate limit) — recharge and re-run; "
              "skipped rows will retry automatically.", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description="Generate cover images + upload to Cloudinary")
    p.add_argument("--db",      default=str(DEFAULT_DB))
    p.add_argument("--limit",   type=int, default=40, metavar="N")
    p.add_argument("--days",    type=int, default=2, metavar="D",
                   help="only NEW articles fetched within the last D days; never regenerates "
                        "(img_gen_tried), so older backlog is left alone to save tokens")
    p.add_argument("--workers", type=int, default=4, metavar="N")
    p.add_argument("--prefix",  default=os.environ.get("CLOUDINARY_FOLDER", "covers"))
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    run(args.db, args.limit, args.days, args.workers, args.prefix, args.dry_run)


if __name__ == "__main__":
    main()
