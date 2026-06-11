#!/usr/bin/env python3
"""
enrich_rewrite.py — turn a source article into an ORIGINAL, SEO+GEO-optimised
article via DeepSeek V4, condensed and restructured in our own words.

Why: re-publishing a source's full text verbatim is duplicate content (Google
won't rank it, AI engines won't cite it) and a copyright risk. This rewrites the
facts into a new article with an Answer-Box lead + H2/H3 structure (路徑 A 守則).

Adaptive by nature & length — every article differs, so the target length scales
with how much real material the source has, and thin/headline-only items are
SKIPPED rather than padded into hallucination.

Each accepted rewrite is self-scored 0-100 (length-fit, structure, Answer-Box,
originality vs source, scannability) and stored, so low scorers can be found and
re-run. If a first attempt scores below the bar, we retry once with a higher
temperature and keep the better of the two.

Stores into hotspots:  article_md, article_score, article_words
Env:  DEEPSEEK_API_KEY (required), DEEPSEEK_API_BASE, DEEPSEEK_MODEL
Usage:
  python enrich_rewrite.py --limit 60
  python enrich_rewrite.py --id 7753,7907,8120     # dev: specific articles
  python enrich_rewrite.py --recheck --id 7753     # force re-run
"""

import os
import re
import sys
import json
import argparse
import sqlite3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import requests

sys.path.insert(0, str(Path(__file__).parent))
import config_loader

DEFAULT_DB = config_loader.db_path()
_API_KEY  = os.environ.get("DEEPSEEK_API_KEY", "")
_API_BASE = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")
_MODEL    = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

# Unified output language for ALL rewrites, regardless of source language
# (sources may be English / 中文 / 日本語 / 한국어). One language keeps the feed
# coherent; multi-language can later generate one column per target language.
REWRITE_LANG = os.environ.get("REWRITE_LANG", "zh-Hant")
_LANG_NAME = {
    "zh-Hant": "Traditional Chinese (繁體中文)",
    "zh-Hans": "Simplified Chinese (简体中文)",
    "en": "English",
    "ja": "Japanese (日本語)",
    "ko": "Korean (한국어)",
}
# Languages we measure length by character (字) rather than by word.
_OUT_CJK = REWRITE_LANG in ("zh-Hant", "zh-Hans", "ja")
_OUT_LANG_NAME = _LANG_NAME.get(REWRITE_LANG, "Traditional Chinese (繁體中文)")

# Below this much real body text we don't have enough to rewrite without
# fabricating — skip and let the original/summary stand.
MIN_BODY_CHARS = 360
# Quality bar (0-100). Below this on the first try, retry once hotter.
SCORE_BAR = 72
# Below this we refuse to publish (wrong language / too weak) — keep the original.
KEEP_FLOOR = 55

_CJK = re.compile(r"[一-鿿぀-ヿ]")
_HAN = re.compile(r"[一-鿿]")
_HANGUL = re.compile(r"[가-힣]")
_KANA = re.compile(r"[぀-ヿ]")


def _detect_lang(text: str) -> str:
    """Rough source-language tag so we can tell the model exactly what to translate."""
    t = text or ""
    if _HANGUL.search(t):
        return "Korean (한국어)"
    if _KANA.search(t):
        return "Japanese (日本語)"
    if len(_HAN.findall(t)) / max(len(t), 1) > 0.2:
        return "Chinese (中文)"
    return "English"

# Roundup/digest articles (daily recaps) bundle many separate stories — they are
# legitimately longer and restate more facts, so they need their own length band
# and a looser originality bar, and read best as one short section per item.
_DIGEST_RE = re.compile(
    r"(昨夜今晨|早报|日报|晚报|周报|月报|要闻|重要资讯|資訊|资讯速览|速览|速覽|盤點|盘点|"
    r"今日.*(资讯|要闻|快讯)|roundup|round-up|recap|daily digest|weekly|this week in)",
    re.I,
)


def _is_digest(title: str, body: str) -> bool:
    if _DIGEST_RE.search(title or ""):
        return True
    # Long source split into many distinct list-like items.
    return len(body) > 5000 and len(re.findall(r"(?m)^\s*[-•·\d]", body)) >= 6


def _is_cjk(text: str) -> bool:
    if not text:
        return False
    return len(_CJK.findall(text)) / max(len(text), 1) > 0.15


def _doc_len(text: str) -> int:
    """A language-neutral 'size': CJK chars counted 1 each, latin counted by word."""
    cjk = len(_CJK.findall(text))
    latin_words = len(re.findall(r"[A-Za-z0-9]+", text))
    return cjk + latin_words


def _target(body: str, cjk: bool, digest: bool = False) -> tuple[int, int, str]:
    """Adaptive output length band (lo, hi) + a human phrase, scaled to input."""
    n = _doc_len(body)
    unit = "字" if cjk else "words"
    if digest:
        # Condense a roundup but keep every item: ~half the source, capped.
        lo, hi = min(int(n * 0.45), 700), min(int(n * 0.75), 1500)
        lo = max(lo, 500)
        return lo, hi, f"{lo}-{hi} {unit}"
    if cjk:
        if n < 700:      lo, hi = 280, 450
        elif n < 1800:   lo, hi = 420, 650
        else:            lo, hi = 600, 880
    else:
        if n < 350:      lo, hi = 180, 300
        elif n < 900:    lo, hi = 280, 430
        else:            lo, hi = 380, 560
    return lo, hi, f"{lo}-{hi} {unit}"


# AI-tells we ban so the prose doesn't read as machine-written (both languages).
_AI_CLICHES = [
    "in conclusion", "it's worth noting", "it is worth noting", "moreover",
    "furthermore", "in the ever-evolving", "in the world of", "delve into",
    "dive into", "landscape of", "game-changer", "it's important to note",
    "as we all know", "navigating the", "robust", "leverage the power",
    "值得注意的是", "綜上所述", "综上所述", "总而言之", "總而言之", "首先，", "其次，",
    "最後，", "不可否認", "在當今", "在当今", "隨著", "众所周知", "總的來說", "总的来说",
]


def _sys_prompt(cjk: bool, target_phrase: str, hot_terms: list[str],
                digest: bool = False, src_lang: str = "") -> str:
    lang = _OUT_LANG_NAME
    src_line = ""
    if src_lang and src_lang.split()[0] not in lang:
        src_line = (f"- The source is written in {src_lang}. Translate ALL of it into "
                    f"{lang}; the output must contain NO {src_lang} text at all.\n")
    digest_line = ""
    if digest:
        digest_line = (
            "- This source is a NEWS ROUNDUP of several separate stories. Keep each "
            "distinct story as its own short `## ` section with a specific headline; "
            "lead the whole piece with one Answer-Box sentence naming the 2-3 biggest "
            "items. Do not merge unrelated stories.\n"
        )
    terms_line = ""
    if hot_terms:
        terms_line = (
            "- Current trending search terms readers are using right now: "
            f"{', '.join(hot_terms)}. Weave in ONLY the ones genuinely relevant to "
            "this story, naturally inside real sentences (never a keyword list, never "
            "forced). Ignore the rest. Relevance and fluency beat coverage.\n"
        )
    return (
        "You are a senior crypto & finance journalist writing ORIGINAL, search- and "
        "AI-citable news. Rewrite the source into a NEW article — in your OWN words, "
        "restructured — never copying sentences verbatim.\n"
        "Rules:\n"
        + src_line +
        f"- ALWAYS write in {lang}, no matter the source language (English, 中文, "
        "日本語 or 한국어). Translate and rewrite the facts into the target language; "
        "keep proper nouns, tickers and figures accurate. The ENTIRE output must be "
        f"{lang} only — never mix in the source language.\n"
        + ("- If the source is Simplified Chinese, CONVERT every character to "
           "Traditional Chinese (繁體中文 / 台灣用字). Leave no simplified characters "
           "(e.g. 币→幣, 冲→衝, 实→實, 关→關, 价→價).\n" if REWRITE_LANG == "zh-Hant" else "") +
        "- Also write a NEW headline in the target language: factual, specific, "
        "<= 40 characters (Chinese) / <= 12 words (English), no clickbait.\n"
        "- Open with a 2-3 sentence ANSWER-BOX paragraph that states the single most "
        "important fact first (the what/number/date), so an AI engine can quote it directly.\n"
        "- Then use 2-4 Markdown `## ` headings; use `- ` bullet lists for figures, "
        "dates or multi-point facts where natural.\n"
        + digest_line + terms_line +
        "- Sound like a real human reporter: vary sentence length and rhythm, use "
        "plain confident prose, concrete specifics. A reader must NOT be able to tell "
        "it was AI-written.\n"
        "- BANNED filler/AI-tells (never use): " + ", ".join(_AI_CLICHES[:14]) + ", etc. "
        "Don't start sentences with formulaic connectors.\n"
        "- Use ONLY facts present in the source. NEVER invent numbers, quotes, names, "
        "dates or causes. If the source is thin, write the shorter end of the range "
        "rather than padding.\n"
        "- Neutral and factual: no hype, no marketing, no investment advice, no first person.\n"
        f"- Target length: about {target_phrase}.\n"
        'Return ONLY a JSON object: {"title": "<headline>", "article": "<markdown>"}.'
    )


def _call_llm(title: str, body: str, cjk: bool, target_phrase: str, hot_terms: list[str],
              temperature: float, max_tokens: int, digest: bool = False,
              src_lang: str = "", timeout: int = 120) -> tuple[str, str] | None:
    content = f"SOURCE TITLE: {title}\n\nSOURCE BODY:\n{body[:8000]}"
    try:
        r = requests.post(
            f"{_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": _MODEL,
                "messages": [{"role": "system", "content": _sys_prompt(cjk, target_phrase, hot_terms, digest, src_lang)},
                             {"role": "user", "content": content}],
                "response_format": {"type": "json_object"},
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            timeout=timeout,
        )
        if r.status_code != 200:
            return None
        txt = r.json()["choices"][0]["message"]["content"]
        txt = re.sub(r"^```(?:json)?|```$", "", txt.strip()).strip()
        obj = json.loads(txt)
        art = (obj.get("article") or "").strip()
        title = (obj.get("title") or "").strip()
        return (art, title) if art else None
    except Exception:
        return None


# High-frequency Simplified-only characters — their presence in a zh-Hant target
# means the model left the source's simplified script unconverted.
_SIMPLIFIED = set(
    "币实关价冲东车长马门问对说时间会这们来国话应风涨跌资产货网优体总经过进远开电脑级别认证"
    "导护齐压块链发钱银额买卖结构数据规则审查约场监营业额华尔约镇赛"
)


def _shingles(text: str, k: int = 5) -> set[str]:
    t = re.sub(r"\s+", "", re.sub(r"[#*\-`>]", "", text.lower()))
    return {t[i:i + k] for i in range(0, max(len(t) - k + 1, 0))} or {t}


def _score(article: str, source: str, cjk: bool, lo: int, hi: int,
           hot_terms: list[str], digest: bool = False) -> tuple[int, int]:
    """Heuristic quality 0-100 + word count. Higher = more publishable."""
    if not article:
        return 0, 0
    words = _doc_len(article)
    lines = [l.strip() for l in article.splitlines() if l.strip()]
    h2 = sum(1 for l in lines if l.startswith("## "))
    bullets = sum(1 for l in lines if l.startswith("- "))
    paras = [l for l in lines if not l.startswith("#") and not l.startswith("- ")]

    # 1) length fit (30): full marks inside band, linear falloff outside
    if lo <= words <= hi:
        s_len = 30.0
    elif words < lo:
        s_len = 30.0 * max(0.0, words / lo) ** 1.5
    else:
        s_len = 30.0 * max(0.0, 1 - (words - hi) / hi)

    # 2) structure (20): wants >=2 H2; small credit for lists
    s_struct = min(20.0, h2 * 8 + min(bullets, 3) * 2)

    # 3) answer-box lead (15): first paragraph is a real 1-3 sentence lead
    s_lead = 0.0
    if paras:
        lead_len = _doc_len(paras[0])
        if (25 if cjk else 12) <= lead_len <= (160 if cjk else 90):
            s_lead = 15.0
        elif lead_len:
            s_lead = 7.0

    # 4) originality vs source (25): low shingle overlap = rewritten, not copied.
    # Roundups legitimately restate more facts, so the bar is looser for them.
    a, b = _shingles(article), _shingles(source)
    overlap = len(a & b) / max(len(a), 1)
    orig_ceiling = 0.45 if digest else 0.30
    s_orig = 25.0 * max(0.0, 1 - overlap / orig_ceiling)

    # 5) scannability (10): multiple paragraphs/sections
    s_scan = min(10.0, (len(paras) >= 3) * 6 + (h2 >= 2) * 4)

    base = s_len + s_struct + s_lead + s_orig + s_scan

    # Hard target-language gate: if the output isn't actually in the target language
    # (e.g. Korean/Japanese/English left untranslated), force a failing score so it
    # is retried and ultimately skipped rather than published in the wrong language.
    if cjk and REWRITE_LANG.startswith("zh"):
        letters = [c for c in article if c.strip() and not c.isascii()
                   or ("a" <= c.lower() <= "z")]
        han = len(_HAN.findall(article))
        wrong = len(_HANGUL.findall(article)) + len(_KANA.findall(article))
        han_ratio = han / max(len(letters), 1)
        if wrong > 5 or han_ratio < 0.45:
            return min(round(base), 25), words

    # Naturalness penalty: every AI-tell / formulaic phrase costs points so the
    # prose can't read as machine-written.
    low = article.lower()
    cliches = sum(low.count(c.lower()) for c in _AI_CLICHES)
    # SEO/GEO weaving bonus: credit for naturally including relevant hot terms.
    hits = sum(1 for t in hot_terms if t and t.lower() in low)
    seo_bonus = min(6.0, hits * 3.0)

    # Simplified-Chinese leakage penalty when the target is Traditional — the feed
    # must be one consistent script.
    simp_pen = 0.0
    if REWRITE_LANG == "zh-Hant":
        simp = sum(1 for ch in article if ch in _SIMPLIFIED)
        simp_pen = min(25.0, simp * 2.0)

    total = max(0.0, min(100.0, base - 5.0 * cliches + seo_bonus - simp_pen))
    return round(total), words


def _ensure_cols(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(hotspots)")}
    for name, decl in (("article_md", "TEXT"), ("article_title", "TEXT"),
                       ("article_score", "INTEGER"), ("article_words", "INTEGER")):
        if name not in cols:
            conn.execute(f"ALTER TABLE hotspots ADD COLUMN {name} {decl}")
    conn.commit()


def _trending_terms(conn: sqlite3.Connection, window_hours: int = 72, top: int = 24) -> list[str]:
    """Hot search terms from our own recent corpus — the AI-extracted keywords +
    coin tickers most frequent across the last few days. This is our live read on
    'what readers are searching right now', fed back into each rewrite for SEO/GEO."""
    from collections import Counter
    rows = conn.execute(
        f"""SELECT COALESCE(keywords,'') AS k, COALESCE(symbols,'') AS s FROM hotspots
            WHERE fetched_at >= datetime('now','-{int(window_hours)} hours')"""
    ).fetchall()
    c: Counter = Counter()
    for r in rows:
        for term in re.split(r"[,，]", r["k"]):
            t = term.strip()
            if 2 <= len(t) <= 24:
                c[t] += 1
        for pair in r["s"].split(","):
            base = pair.split("_")[0].strip()
            if base:
                c[base] += 1
    return [t for t, _ in c.most_common(top)]


def rewrite_one(title: str, body: str, hot_terms: list[str] | None = None) -> tuple[str, str, int, int] | None:
    """Return (article_md, new_title, score, words) or None if skipped/failed."""
    if len(body.strip()) < MIN_BODY_CHARS:
        return None  # too thin to rewrite without fabricating
    hot_terms = hot_terms or []
    cjk = _OUT_CJK                      # length/scoring follow the OUTPUT language
    digest = _is_digest(title, body)
    src_lang = _detect_lang(f"{title} {body[:600]}")
    lo, hi, phrase = _target(body, cjk, digest)
    max_tokens = int(hi * (2.2 if cjk else 1.8)) + 400

    # Cross-language jobs are harder, so allow an extra, hotter retry.
    cross = src_lang.split()[0] not in _OUT_LANG_NAME
    temps = (0.5, 0.7, 0.85) if cross else (0.55, 0.8)

    best = None
    for temp in temps:
        res = _call_llm(title, body, cjk, phrase, hot_terms, temperature=temp,
                        max_tokens=max_tokens, digest=digest, src_lang=src_lang)
        if not res:
            continue
        art, new_title = res
        score, words = _score(art, body, cjk, lo, hi, hot_terms, digest)
        if best is None or score > best[2]:
            best = (art, new_title, score, words)
        if score >= SCORE_BAR:
            break
    # Don't publish a wrong-language / very weak rewrite — keep the original instead.
    if best and best[2] < KEEP_FLOOR:
        return None
    return best


def run(db_path: str, limit: int, ids: list[int], workers: int, recheck: bool) -> None:
    if not _API_KEY:
        print("ERROR: DEEPSEEK_API_KEY not set (source your .env).", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA busy_timeout=30000")   # survive the 2-hourly refresh writer
    conn.row_factory = sqlite3.Row
    _ensure_cols(conn)

    if ids:
        q = (f"SELECT id, title, COALESCE(NULLIF(fulltext,''), content, '') AS body "
             f"FROM hotspots WHERE id IN ({','.join('?' * len(ids))})")
        rows = conn.execute(q, ids).fetchall()
    else:
        where = "category != 'markets' AND title != '' AND length(COALESCE(NULLIF(fulltext,''),content,'')) >= ?"
        if not recheck:
            where += " AND (article_md IS NULL OR article_md = '')"
        rows = conn.execute(
            f"""SELECT id, title, COALESCE(NULLIF(fulltext,''), content, '') AS body
                FROM hotspots WHERE {where}
                ORDER BY (importance IN ('urgent','high')) DESC,
                         COALESCE(NULLIF(published_at,''), fetched_at) DESC
                LIMIT ?""",
            (MIN_BODY_CHARS, limit),
        ).fetchall()

    print(f"Articles to rewrite: {len(rows)}", file=sys.stderr)
    if not rows:
        conn.close()
        return

    hot_terms = _trending_terms(conn)
    print(f"Trending terms fed to rewrites: {', '.join(hot_terms) or '(none)'}", file=sys.stderr)

    def work(row):
        res = rewrite_one(row["title"], row["body"] or "", hot_terms)
        return (row["id"], row["title"], res)

    ok = skipped = 0
    scores = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for rid, title, res in pool.map(work, rows):
            if not res:
                skipped += 1
                continue
            art, new_title, score, words = res
            conn.execute(
                "UPDATE hotspots SET article_md=?, article_title=?, article_score=?, article_words=? WHERE id=?",
                (art, new_title or None, score, words, rid),
            )
            ok += 1
            scores.append(score)
            print(f"  [{score:3}] {words:4}w  id={rid}  {(new_title or title)[:48]}", file=sys.stderr)
            if ok % 10 == 0:
                conn.commit()
    conn.commit()
    conn.close()
    avg = sum(scores) / len(scores) if scores else 0
    low = sum(1 for s in scores if s < SCORE_BAR)
    print(f"Done — rewrote {ok} (skipped {skipped} thin). avg score {avg:.0f}, "
          f"{low} below bar {SCORE_BAR}.", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description="Rewrite articles into original SEO/GEO content via DeepSeek")
    p.add_argument("--db",      default=str(DEFAULT_DB))
    p.add_argument("--limit",   type=int, default=60, metavar="N")
    p.add_argument("--id",      default="", help="comma-separated article ids (dev)")
    p.add_argument("--workers", type=int, default=4, metavar="N")
    p.add_argument("--recheck", action="store_true")
    args = p.parse_args()
    ids = [int(x) for x in args.id.split(",") if x.strip().isdigit()]
    run(args.db, args.limit, ids, args.workers, args.recheck)


if __name__ == "__main__":
    main()
