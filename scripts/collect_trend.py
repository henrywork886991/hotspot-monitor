#!/usr/bin/env python3
"""
collect_trend.py — Collect crypto/tech hotspot data from 14+ sources.
Outputs a JSON array to stdout. Pipe into save_to_db.py to persist.

Usage:
  python collect_trend.py                                     # all categories
  python collect_trend.py --category crypto                   # crypto/web3 only
  python collect_trend.py --category tech                     # tech/programming only
  python collect_trend.py --days 2                            # last 2 days only
  python collect_trend.py --twitter-buddy-dir ~/tw/data/tweets/
  python collect_trend.py | python save_to_db.py              # collect + save to DB
"""

import sys
import os
import re
import json
import argparse
import requests
import xml.etree.ElementTree as ET
import glob
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from bs4 import BeautifulSoup
    _BS4 = True
except ImportError:
    _BS4 = False

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/rss+xml, application/atom+xml, text/xml, */*",
}
_ATOM = "{http://www.w3.org/2005/Atom}"
_DC   = "{http://purl.org/dc/elements/1.1/}"

# ── Category filter regexes ───────────────────────────────────────────────────
_CRYPTO_RE = re.compile(
    # ── Protocol / chain names ─────────────────────────────────────────────
    r"\b(bitcoin|btc|ethereum|eth|solana|sol|bnb|xrp|cardano|ada|avalanche|avax|"
    r"polkadot|dot|dogecoin|doge|shib|polygon|matic|arbitrum|arb|optimism|"
    r"sui|aptos|apt|toncoin|ton|cosmos|atom|near|pepe|wif|bonk|floki|"
    r"usdt|usdc|dai|usdb|busd|frax|pyusd|tusd|"
    r"link|uni|aave|crv|mkr|snx|comp|lido|rpl|gmx|jup|jto|ondo|"
    r"render|rndr|fetch|fet|grt|ocean|imx|blur|magic|dydx|"
    r"ltc|bch|etc|trx|xlm|algo|vet|icp|egld|theta|hbar|xtz|flow|"
    r"gala|axs|sand|mana|ape|gods|ilv|high|looks|x2y2|"
    r"ordi|sats|rats|nals|rats|rune|bitmap|brc20|"
    r"hyperliquid|raydium|uniswap|opensea|polymarket|pump\.fun|"
    r"coinbase|binance|bybit|okx|kraken|bitget|bitmex|"
    r"sei|mantle|manta|zksync|starknet|linea|scroll)\b|"
    # ── Crypto $TICKER whitelist (known tokens only, NOT stocks) ──────────
    r"\$(BTC|ETH|SOL|BNB|XRP|ADA|AVAX|DOT|DOGE|SHIB|MATIC|ARB|OP|SUI|APT|"
    r"TON|NEAR|PEPE|WIF|BONK|FLOKI|USDT|USDC|DAI|LINK|UNI|AAVE|CRV|MKR|"
    r"SNX|ATOM|FIL|LTC|BCH|ETC|TRX|XLM|ALGO|VET|ICP|EGLD|FTM|ONE|ROSE|"
    r"ZIL|QTUM|ZEC|DASH|XMR|THETA|HBAR|FLOW|AXS|SAND|MANA|APE|GMX|JUP|"
    r"JTO|ONDO|RNDR|FET|GRT|OCEAN|IMX|BLUR|DYDX|ORDI|SATS|RUNE|GALA|"
    r"MSTR|COIN|HUT|MARA|RIOT|CLSK|BTBT|CIFR|CORZ)\b|"
    # ── DeFi / on-chain activities ─────────────────────────────────────────
    r"\b(defi|nft|web3|blockchain|crypto|dex|dao|cex|amm|tvl|evm|rollup|"
    r"l2\b|layer2|zk\b|zkp|stablecoin|airdrop|staking|stake|yield\b|"
    r"liquidity|memecoin|altcoin|rwa|tokeniz)\b|"
    # ── Chinese blockchain-specific terms (NOT generic finance) ─────────────
    r"(链上|公链|侧链|跨链|代币|空投|质押|挖矿|矿机|去中心化|"
    r"做多|做空|爆仓|合约|现货|永续|资金费率|减半|"
    r"币圈|大饼|以太坊|比特币|山寨|稳定币|流动性|清算|杠杆|"
    r"链游|NFT|Web3|DeFi|区块链|链下|跨链桥|闪电贷|流动性挖矿)",
    re.IGNORECASE,
)
_TECH_RE = re.compile(
    r"llm|ai|gpt|claude|gemini|open.?source|github|docker|kubernetes|k8s|"
    r"rust|golang|python|typescript|react|nextjs|vercel|aws|gcp|azure|"
    r"api|sdk|cli|framework|library|hackernews|programming|developer|"
    r"linux|terminal|release|agent|rag|vector|embedding|fine.?tun|"
    r"人工智能|大模型|开源|算法|机器学习|编程|开发者|工程师|代码|框架",
    re.IGNORECASE,
)

def _is_relevant(text: str, category: str) -> bool:
    if category == "all":
        return bool(_CRYPTO_RE.search(text) or _TECH_RE.search(text))
    if category == "crypto":
        return bool(_CRYPTO_RE.search(text))
    if category == "tech":
        return bool(_TECH_RE.search(text))
    return True


# ── Generic RSS / Atom fetcher ────────────────────────────────────────────────

def _parse_date(s: str) -> datetime | None:
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f%z",
    ):
        try:
            return datetime.strptime(s.strip(), fmt)
        except ValueError:
            continue
    return None


def fetch_rss(url: str, source: str, max_items: int = 15, max_age_days: int = 3,
              source_type: str = "rss") -> list[dict]:
    """Generic RSS/Atom fetcher. No category filter — source itself guarantees relevance."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=12, allow_redirects=True)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        items = root.findall(".//item") or root.findall(f".//{_ATOM}entry")
        results = []
        for item in items:
            title = (
                item.findtext("title") or item.findtext(f"{_ATOM}title") or ""
            ).strip()
            if not title:
                continue
            link = item.findtext("link") or item.findtext(f"{_ATOM}id") or ""
            if not link:
                link_el = item.find(f"{_ATOM}link")
                if link_el is not None:
                    link = link_el.get("href", "")
            desc = (
                item.findtext("description")
                or item.findtext(f"{_ATOM}summary")
                or item.findtext(f"{_ATOM}content")
                or ""
            )
            desc = re.sub(r"<[^>]+>", " ", desc).strip()[:500]
            pub_str = (
                item.findtext("pubDate")
                or item.findtext(f"{_ATOM}published")
                or item.findtext(f"{_ATOM}updated")
                or ""
            )
            pub_dt = _parse_date(pub_str)
            if pub_dt and pub_dt.tzinfo and pub_dt < cutoff:
                continue
            results.append({
                "title": title, "content": desc, "url": link.strip(),
                "source": source, "source_type": source_type,
                "published_at": pub_str,
            })
            if len(results) >= max_items:
                break
        return results
    except Exception as e:
        print(f"[{source}] ERROR: {e}", file=sys.stderr)
        return []


# ── Platform-specific fetchers ────────────────────────────────────────────────

def fetch_github_trending(category: str = "all") -> list[dict]:
    """HTML scrape — GitHub Trending daily. Requires beautifulsoup4."""
    if not _BS4:
        print("[github_trending] SKIP: pip install beautifulsoup4", file=sys.stderr)
        return []
    try:
        resp = requests.get(
            "https://github.com/trending",
            params={"since": "daily"},
            headers={**_HEADERS, "Accept": "text/html"},
            timeout=15,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for repo in soup.select("article.Box-row"):
            name_el = repo.select_one("h2 a")
            if not name_el:
                continue
            name = "/".join(name_el.get_text(strip=True).split())
            url = "https://github.com" + name_el.get("href", "")
            desc_el = repo.select_one("p")
            desc = desc_el.get_text(strip=True) if desc_el else ""
            lang_el = repo.select_one('[itemprop="programmingLanguage"]')
            lang = lang_el.get_text(strip=True) if lang_el else ""
            stars_el = repo.select_one('a[href*="stargazers"]')
            stars = stars_el.get_text(strip=True) if stars_el else ""
            combined = f"{name} {desc} {lang}"
            if not _is_relevant(combined, category):
                continue
            results.append({
                "title": f"{name} — {desc[:80]}" if desc else name,
                "content": f"Language: {lang} | Stars: {stars}\n{desc}",
                "url": url, "source": "github_trending", "source_type": "html",
                "published_at": "",
            })
        return results
    except Exception as e:
        print(f"[github_trending] ERROR: {e}", file=sys.stderr)
        return []


def fetch_hackernews(days: int = 1) -> list[dict]:
    """Free Algolia JSON API — no key needed."""
    since_ts = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    try:
        resp = requests.get(
            "https://hn.algolia.com/api/v1/search",
            params={"query": "", "tags": "story", "hitsPerPage": 20,
                    "numericFilters": f"created_at_i>{since_ts}"},
            timeout=10,
        )
        resp.raise_for_status()
        return [
            {"title": h.get("title", ""),
             "content": f"Points: {h.get('points', 0)} | Comments: {h.get('num_comments', 0)}",
             "url": h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}",
             "source": "hackernews", "source_type": "api",
             "published_at": h.get("created_at", "")}
            for h in resp.json().get("hits", []) if h.get("title")
        ]
    except Exception as e:
        print(f"[hackernews] ERROR: {e}", file=sys.stderr)
        return []


def fetch_v2ex(category: str = "all") -> list[dict]:
    """Official public V2EX API — no key needed."""
    try:
        resp = requests.get(
            "https://www.v2ex.com/api/topics/hot.json",
            headers={"User-Agent": "hotspot-monitor/1.0"},
            timeout=10,
        )
        resp.raise_for_status()
        results = []
        for t in resp.json():
            title = t.get("title", "")
            node  = t.get("node", {}).get("title", "")
            content = t.get("content", "") or f"Node: {node}"
            combined = f"{title} {node} {content}"
            if not _is_relevant(combined, category):
                continue
            results.append({
                "title": title, "content": content[:400],
                "url": t.get("url", ""), "source": "v2ex", "source_type": "api",
                "published_at": "",
            })
        return results
    except Exception as e:
        print(f"[v2ex] ERROR: {e}", file=sys.stderr)
        return []


def fetch_coingecko() -> list[dict]:
    """CoinGecko trending coins — free API, updated every ~15 min."""
    try:
        resp = requests.get(
            "https://api.coingecko.com/api/v3/search/trending",
            headers={"Accept": "application/json"}, timeout=10,
        )
        resp.raise_for_status()
        results = []
        for entry in resp.json().get("coins", []):
            item = entry.get("item", {})
            name, symbol = item.get("name", ""), item.get("symbol", "")
            rank  = item.get("market_cap_rank", "N/A")
            data  = item.get("data", {})
            price = data.get("price", "")
            chg   = data.get("price_change_percentage_24h", {})
            chg_usd = chg.get("usd", "") if isinstance(chg, dict) else ""
            content = f"Rank: #{rank} | Price: {price}"
            if chg_usd:
                content += f" | 24h: {chg_usd:.2f}%"
            results.append({
                "title": f"{name} ({symbol}) trending on CoinGecko",
                "content": content,
                "url": f"https://www.coingecko.com/en/coins/{item.get('id', '')}",
                "source": "coingecko", "source_type": "api",
                "published_at": "",
            })
        return results
    except Exception as e:
        print(f"[coingecko] ERROR: {e}", file=sys.stderr)
        return []


def fetch_sopilot(category: str = "all") -> list[dict]:
    """SoPilot RSS — Chinese AI+Crypto Twitter hot posts. Mixed source: regex filtered."""
    results = []
    try:
        resp = requests.get("https://sopilot.net/rss/hottweets",
                            headers={"User-Agent": "hotspot-monitor/1.0"}, timeout=10)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        channel = root.find("channel")
        if channel is None:
            return []
        for item in channel.findall("item"):
            title = item.findtext("title", "").strip()
            desc  = item.findtext("description", "").strip()
            link  = item.findtext("link", "").strip()

            # SoPilot appends metrics + "原推链接: https://x.com/username/status/..."
            # to every description. Strip that footer before relevance check so
            # usernames like @NFTCPS or @Web3zy8 don't cause false-positive matches.
            tweet_text = re.split(r'\n\n❤️|\n❤️|原推链接', desc, maxsplit=1)[0].strip()

            if not _is_relevant(f"{title} {tweet_text}", category):
                continue
            results.append({
                "title": title, "content": tweet_text[:500], "url": link,
                "source": "sopilot_twitter", "source_type": "rss",
                "published_at": item.findtext("pubDate", ""),
            })
    except Exception as e:
        print(f"[sopilot] ERROR: {e}", file=sys.stderr)
    return results


def fetch_twitter_buddy(data_dir: str, max_age_hours: int = 6) -> list[dict]:
    """Read tweets collected by twitter-buddy from local JSON files."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    results, seen = [], set()
    for fpath in sorted(glob.glob(os.path.join(data_dir, "tweets_*.json")), reverse=True)[:3]:
        try:
            with open(fpath, encoding="utf-8") as f:
                tweets = json.load(f)
            for t in tweets:
                pub_str = t.get("time", "")
                try:
                    pub_dt = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                    if pub_dt < cutoff:
                        continue
                except ValueError:
                    pass
                link = t.get("link", "")
                if not link or link in seen:
                    continue
                seen.add(link)
                if t.get("type") == "retweet":
                    continue
                text = t.get("text", "")
                quoted = t.get("quoted")
                if quoted:
                    text += f"\n[Quote] {quoted.get('text', '')}"
                results.append({
                    "title": f"{t.get('user', '')} on X",
                    "content": text[:600], "url": link,
                    "source": "twitter_buddy", "source_type": "local_file",
                    "published_at": pub_str,
                })
        except Exception as e:
            print(f"[twitter_buddy] {fpath}: {e}", file=sys.stderr)
    return results


# ── Source routing ────────────────────────────────────────────────────────────

_CRYPTO_RSS = [
    ("https://www.coindesk.com/arc/outboundfeeds/rss/", "coindesk",      15),
    ("https://decrypt.co/feed",                          "decrypt",       15),
    ("https://thedefiant.io/feed",                       "the_defiant",   15),
    ("https://cointelegraph.com/rss",                    "cointelegraph", 15),
    # Community / newsletter sources — used as backup for social section
    ("https://wublock.substack.com/feed",               "wu_blockchain",  8),
    ("https://unchainedcrypto.com/feed/",               "unchained",      8),
]
_TECH_RSS = [
    ("https://techcrunch.com/feed/",                    "techcrunch",   15),
    ("https://feeds.arstechnica.com/arstechnica/index", "arstechnica",  15),
    ("https://www.theverge.com/rss/index.xml",          "the_verge",    10),
    ("https://www.404media.co/rss/",                    "404media",     10),
]


def collect_all(category: str = "all", days: int = 3,
                twitter_buddy_dir: str | None = None) -> list[dict]:
    jobs: dict = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        if category in ("crypto", "all"):
            for url, src, limit in _CRYPTO_RSS:
                jobs[src] = pool.submit(fetch_rss, url, src, limit, days, "rss")
            jobs["coingecko"] = pool.submit(fetch_coingecko)

        if category in ("tech", "all"):
            for url, src, limit in _TECH_RSS:
                jobs[src] = pool.submit(fetch_rss, url, src, limit, days, "rss")
            jobs["github_trending"] = pool.submit(fetch_github_trending, category)
            jobs["hackernews"]      = pool.submit(fetch_hackernews, days)

        if twitter_buddy_dir:
            jobs["twitter_buddy"] = pool.submit(fetch_twitter_buddy, twitter_buddy_dir, days * 24)

        jobs["sopilot"] = pool.submit(fetch_sopilot, category)
        jobs["v2ex"]    = pool.submit(fetch_v2ex,    category)

        all_items: list[dict] = []
        for name, future in jobs.items():
            try:
                items = future.result()
                print(f"  [{name}] {len(items)}", file=sys.stderr)
                all_items.extend(items)
            except Exception as e:
                print(f"  [{name}] ERROR: {e}", file=sys.stderr)

    seen, unique = set(), []
    for item in all_items:
        if item["url"] and item["url"] not in seen:
            seen.add(item["url"])
            unique.append(item)

    return unique


# ── Twitter auto-collection ───────────────────────────────────────────────────

def _auto_collect_twitter(scrolls: int, fresh_hours: int) -> str | None:
    """
    Trigger collect_twitter.py if data is stale or missing.
    Returns the tweets directory path (whether or not collection ran).
    """
    try:
        import collect_twitter as ct
    except ImportError:
        print("[twitter] collect_twitter.py not found — skipping", file=sys.stderr)
        return None

    tweets_dir = ct.TWEETS_DIR

    if fresh_hours and ct.is_fresh(tweets_dir, fresh_hours):
        print(f"[twitter] Data is fresh (< {fresh_hours}h) — using cached tweets",
              file=sys.stderr)
        return str(tweets_dir)

    if not ct.is_logged_in(ct.PROFILE_DIR):
        print("[twitter] No saved session — run: python collect_twitter.py --login",
              file=sys.stderr)
        return None

    print(f"[twitter] Collecting fresh tweets (scrolls={scrolls})...", file=sys.stderr)
    ct.collect_tweets(ct.PROFILE_DIR, scrolls, tweets_dir, headless=True)
    return str(tweets_dir)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="Collect crypto/tech hotspot data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python collect_trend.py --category crypto
  python collect_trend.py --with-twitter              # auto-collect tweets
  python collect_trend.py --with-twitter --fresh 4    # skip tweets if < 4h old
  python collect_trend.py | python save_to_db.py
        """,
    )
    p.add_argument("--category",         choices=["crypto", "tech", "all"], default="all")
    p.add_argument("--days",             type=int, default=3)
    p.add_argument("--twitter-buddy-dir", metavar="DIR",
                   help="Use existing twitter-buddy data directory")
    p.add_argument("--with-twitter",     action="store_true",
                   help="Auto-collect fresh tweets via browser (requires --login first)")
    p.add_argument("--twitter-scrolls",  type=int, default=80, metavar="N",
                   help="Scroll count when auto-collecting tweets (default: 80)")
    p.add_argument("--fresh",            type=int, default=4, metavar="HOURS",
                   help="With --with-twitter: skip collection if data < N hours old (default: 4)")
    p.add_argument("--pretty",           action="store_true")
    args = p.parse_args()

    # Resolve Twitter source
    twitter_dir = args.twitter_buddy_dir
    if args.with_twitter and not twitter_dir:
        twitter_dir = _auto_collect_twitter(args.twitter_scrolls, args.fresh)

    print(f"Collecting [{args.category}] last {args.days}d ...", file=sys.stderr)
    results = collect_all(args.category, args.days, twitter_dir)
    print(f"Total: {len(results)} unique items", file=sys.stderr)

    indent = 2 if args.pretty else None
    print(json.dumps(results, ensure_ascii=False, indent=indent))


if __name__ == "__main__":
    main()
