#!/usr/bin/env python3
"""
collect_trend.py — Collect crypto/tech hotspot data from 55+ sources.
Outputs a JSON array to stdout. Pipe into save_to_db.py to persist.

Categories:
  all         — Everything (default)
  crypto      — English crypto news + regulation + on-chain + Asian media
  defi        — DeFi protocols, on-chain analytics, DEX data
  web3        — L2/infra blogs (Arbitrum, StarkNet, Optimism, zkSync, Base…)
  cn_crypto   — Chinese crypto media (PANews, ODaily, BlockTempo, SoPilot…)
  asia        — Asian regional media (JP, KR, TW)
  stocks      — US/global equity markets (Yahoo Finance, MarketWatch, CNBC…)
  macro       — Forex, rates, macro (FXStreet, ForexLive, TradingView…)
  regulation  — Crypto regulation (Coin Center, CoinTelegraph Reg, Chainalysis…)
  tech        — Tech/programming (TechCrunch, ArsTechnica, HackerNews, GitHub…)

Usage:
  python collect_trend.py                                     # all categories
  python collect_trend.py --category stocks                   # US stocks only
  python collect_trend.py --category cn_crypto                # Chinese crypto only
  python collect_trend.py --category defi                     # DeFi/on-chain only
  python collect_trend.py --days 2                            # last 2 days only
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
    ("https://www.qbitai.com/feed",                     "qbitai",       10),  # 量子位
    ("https://dev.to/feed",                             "devto",        12),  # 開發社群
    ("https://lobste.rs/rss",                           "lobsters",     12),  # 程式社群
    ("https://www.producthunt.com/feed",                "producthunt",  10),  # 新產品/工具
    ("https://www.latent.space/feed",                   "latentspace",  10),  # AI 週報
]
_CRYPTO_RSS_EXTRA = [
    ("https://cryptoslate.com/feed/",                "cryptoslate",  10),
    ("https://beincrypto.com/feed/",                 "beincrypto",   10),
    ("https://medium.com/feed/centrifuge",           "centrifuge",    8),  # RWA/DeFi
    ("https://cryptobriefing.com/feed/",              "cryptobriefing", 12),
    ("https://ambcrypto.com/feed/",                  "ambcrypto",    10),
    ("https://protos.com/feed/",                     "protos",       10),
]
_REGULATION_RSS = [
    ("https://www.coincenter.org/feed/",             "coin_center",   8),  # weekly — uses _SLOW_AGE
    ("https://cointelegraph.com/rss/tag/regulation", "ct_regulation", 10),
    ("https://cryptonews.com/news/feed/",            "cryptonews",    10),
    ("https://blog.chainalysis.com/feed/",           "chainalysis",   8),  # biweekly — uses _SLOW_AGE
]
_CHINESE_RSS = [
    ("https://rss.odaily.news/rss/newsflash",         "odaily_flash", 15),
    ("https://rss.odaily.news/rss/post",              "odaily_post",  10),
    ("https://www.36kr.com/feed",                     "36kr",         12),  # 中文科技/創業
]
_ONCHAIN_RSS = [
    ("https://insights.glassnode.com/rss/",          "glassnode",     8),
    ("https://ens.domains/blog/rss.xml",             "ens_blog",      8),  # weekly — uses _SLOW_AGE
    ("https://medium.com/feed/intotheblock",         "intotheblock",  8),
]
_DERIVATIVES_RSS = [
    ("https://blog.synthetix.io/rss/",              "synthetix",      8),
]
_WEB3_INFRA_RSS = [
    ("https://medium.com/feed/offchainlabs",        "arbitrum",       8),
    ("https://medium.com/feed/starkware",           "starknet",       8),
    ("https://medium.com/feed/walletconnect",       "walletconnect",  8),
    ("https://optimism.mirror.xyz/feed/atom",       "optimism",       8),
    ("https://zksync.mirror.xyz/feed/atom",         "zksync",         8),  # zkSync Era
    ("https://medium.com/feed/matter-labs",         "matter_labs",    8),  # zkSync team blog
]
_DEFI_PROTOCOL_RSS = [
    ("https://medium.com/feed/aave",                "aave_blog",      8),
    ("https://medium.com/feed/balancer-protocol",   "balancer_blog",  8),
]
_CFD_RSS = [
    ("https://www.fxstreet.com/rss/news",            "fxstreet",     12),
    ("https://www.forexlive.com/feed/news",          "forexlive",    12),
]
_STOCKS_RSS = [
    ("https://feeds.marketwatch.com/marketwatch/realtimeheadlines/", "marketwatch",  10),
    ("https://www.cnbc.com/id/10000664/device/rss/rss.html",         "cnbc_finance", 12),
    ("https://www.ft.com/markets?format=rss",        "ft_markets",   10),
    ("https://seekingalpha.com/market_currents.xml", "seeking_alpha",  8),
]
_STOCKS_RSS_EXTRA = [
    ("https://finance.yahoo.com/news/rssindex",             "yahoo_finance", 15),
    ("https://feeds.bbci.co.uk/news/business/rss.xml",      "bbc_business",  12),
    ("https://www.investing.com/rss/news.rss",              "investing_com", 10),
]
_TA_RSS = [
    ("https://www.tradingview.com/feed/",            "tradingview",  15),
]
_REGIONAL_RSS = [
    ("https://coinpost.jp/?feed=rss2",               "coinpost_jp",  10),
    ("https://www.coindeskjapan.com/feed/",          "coindesk_jp",  10),
    ("https://www.tokenpost.kr/rss",                 "tokenpost_kr", 10),
    ("https://www.blocktempo.com/feed/",             "blocktempo",   12),
    ("https://zombit.info/feed/",                    "zombit",       10),
]


# ── New API fetchers ──────────────────────────────────────────────────────────

# Sources that post weekly/biweekly/monthly — use a wider time window than default
_SLOW_AGE: dict[str, int] = {
    "coin_center":   14,
    "ens_blog":      14,
    "chainalysis":   14,
    "centrifuge":    14,
    "aave_blog":     21,
    "balancer_blog": 21,
    "zksync":        21,
    "matter_labs":   21,
    "latentspace":   14,  # AI weekly newsletter
    "36kr":          7,   # posts but sometimes slow
}


def fetch_dexscreener(max_items: int = 15) -> list[dict]:
    """DexScreener top boosted tokens — meme/trending token hotspots."""
    try:
        resp = requests.get(
            "https://api.dexscreener.com/token-boosts/top/v1",
            headers={"Accept": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        results = []
        for token in resp.json()[:max_items]:
            chain = token.get("chainId", "")
            addr = token.get("tokenAddress", "")
            desc = (token.get("description") or "").strip()
            url = token.get("url") or f"https://dexscreener.com/{chain}/{addr}"
            title = f"[{chain.upper()}] {desc[:70]}" if desc else f"[{chain.upper()}] {addr[:16]}..."
            results.append({
                "title": title,
                "content": desc[:400] or f"Trending token on {chain}",
                "url": url,
                "source": "dexscreener",
                "source_type": "api",
                "published_at": "",
            })
        return results
    except Exception as e:
        print(f"[dexscreener] ERROR: {e}", file=sys.stderr)
        return []




def fetch_coingecko_exchanges(max_items: int = 10) -> list[dict]:
    """CoinGecko top exchanges by volume — for exchange/platform comparison vertical."""
    try:
        resp = requests.get(
            "https://api.coingecko.com/api/v3/exchanges",
            params={"per_page": max_items, "page": 1},
            headers={"Accept": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        results = []
        for ex in resp.json():
            name     = ex.get("name", "")
            ex_id    = ex.get("id", "")
            vol_btc  = ex.get("trade_volume_24h_btc") or 0
            country  = ex.get("country") or "Global"
            year     = ex.get("year_established") or ""
            url      = ex.get("url") or f"https://www.coingecko.com/en/exchanges/{ex_id}"
            content  = f"24h Vol: {float(vol_btc):,.1f} BTC | Country: {country}"
            if year:
                content += f" | Est. {year}"
            results.append({
                "title": f"[Exchange] {name} — top {max_items} by volume",
                "content": content,
                "url": url,
                "source": "coingecko_exchanges",
                "source_type": "api",
                "published_at": "",
            })
        return results
    except Exception as e:
        print(f"[coingecko_exchanges] ERROR: {e}", file=sys.stderr)
        return []


def fetch_wallstcn(max_items: int = 15) -> list[dict]:
    """華爾街見聞 — 中文宏觀/外匯/全球金融即時資訊."""
    try:
        resp = requests.get(
            "https://api-one.wallstcn.com/apiv1/content/information-flow",
            params={"channel": "global-channel", "accept": "article", "limit": max_items},
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        entries = resp.json().get("data", {}).get("items", [])
        results = []
        for entry in entries:
            res = entry.get("resource", {})
            title = (res.get("title") or "").strip()
            if not title:
                continue
            uri  = res.get("uri", "")
            desc = (res.get("content_text") or "").strip()[:400]
            ts   = res.get("display_time")
            pub  = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else ""
            results.append({
                "title": title, "content": desc,
                "url": uri or f"https://wallstreetcn.com/articles/{res.get('id','')}",
                "source": "wallstcn", "source_type": "api",
                "published_at": pub,
            })
        return results
    except Exception as e:
        print(f"[wallstcn] ERROR: {e}", file=sys.stderr)
        return []


def fetch_panews_articles(max_items: int = 20) -> list[dict]:
    """PANews /articles — latest Chinese crypto news feed."""
    try:
        resp = requests.get(
            "https://universal-api.panewslab.com/articles",
            params={"lang": "zh", "page": 1, "pageSize": max_items},
            headers={"Accept": "application/json"},
            timeout=12,
        )
        resp.raise_for_status()
        results = []
        for art in resp.json():
            art_id = art.get("id", "")
            title  = (art.get("title") or "").strip()
            desc   = (art.get("desc") or "").strip()
            if not title:
                continue
            url = f"https://www.panewslab.com/zh/articledetails/{art_id}.html"
            views    = (art.get("metric") or {}).get("views", 0)
            content  = desc
            if views:
                content += f" | 閱讀: {views}"
            results.append({
                "title": title,
                "content": content[:500],
                "url": url,
                "source": "panews",
                "source_type": "api",
                "published_at": art.get("publishedAt", ""),
            })
        return results
    except Exception as e:
        print(f"[panews_articles] ERROR: {e}", file=sys.stderr)
        return []


def fetch_panews_daily(days: int = 1) -> list[dict]:
    """PANews /daily-must-reads — editorial picks for today (and optionally yesterday)."""
    results = []
    today = datetime.now(timezone.utc)
    for offset in range(days):
        date_str = (today - timedelta(days=offset)).strftime("%Y-%m-%d")
        try:
            resp = requests.get(
                "https://universal-api.panewslab.com/daily-must-reads",
                params={"date": date_str},
                headers={"Accept": "application/json"},
                timeout=12,
            )
            resp.raise_for_status()
            for entry in resp.json():
                art = entry.get("article") or {}
                art_id = art.get("id", "")
                title  = (art.get("title") or "").strip()
                desc   = (art.get("desc") or "").strip()
                if not title:
                    continue
                url = f"https://www.panewslab.com/zh/articledetails/{art_id}.html"
                results.append({
                    "title": f"[PANews精選] {title}",
                    "content": desc[:500],
                    "url": url,
                    "source": "panews_daily",
                    "source_type": "api",
                    "published_at": art.get("publishedAt", ""),
                })
        except Exception as e:
            print(f"[panews_daily:{date_str}] ERROR: {e}", file=sys.stderr)
    return results


_VALID_CATEGORIES = {
    "all", "crypto", "defi", "web3", "cn_crypto",
    "asia", "stocks", "macro", "regulation", "tech",
}


def collect_all(category: str = "all", days: int = 3,
                twitter_buddy_dir: str | None = None) -> list[dict]:
    C = category
    jobs: dict = {}

    def _rss(lst: list) -> None:
        for url, src, limit in lst:
            if src not in jobs:
                jobs[src] = pool.submit(fetch_rss, url, src, limit,
                                        _SLOW_AGE.get(src, days), "rss")

    def _api(key: str, fn, *args) -> None:
        if key not in jobs:
            jobs[key] = pool.submit(fn, *args)

    with ThreadPoolExecutor(max_workers=24) as pool:

        # ── Crypto (English main stream) ─────────────────────────────────────
        if C in ("crypto", "all"):
            _rss(_CRYPTO_RSS)
            _rss(_CRYPTO_RSS_EXTRA)
            _rss(_REGULATION_RSS)
            _rss(_CHINESE_RSS)
            _rss(_REGIONAL_RSS)
            _api("coingecko",           fetch_coingecko)
            _api("coingecko_exchanges", fetch_coingecko_exchanges)
            _api("dexscreener",         fetch_dexscreener)
            _api("panews_articles",     fetch_panews_articles)
            _api("panews_daily",        fetch_panews_daily)
            _api("sopilot",             fetch_sopilot, C)

        # ── DeFi / On-chain ──────────────────────────────────────────────────
        if C in ("defi", "all"):
            _rss(_ONCHAIN_RSS)
            _rss(_DERIVATIVES_RSS)
            _rss(_DEFI_PROTOCOL_RSS)
            _rss(_WEB3_INFRA_RSS)
            _api("dexscreener", fetch_dexscreener)
            _api("coingecko",   fetch_coingecko)

        # ── Web3 Infrastructure ──────────────────────────────────────────────
        if C in ("web3", "all"):
            _rss(_WEB3_INFRA_RSS)
            _rss(_ONCHAIN_RSS)

        # ── Chinese Crypto Media ─────────────────────────────────────────────
        if C in ("cn_crypto", "all"):
            _rss(_CHINESE_RSS)
            _rss(_REGIONAL_RSS)
            _api("panews_articles", fetch_panews_articles)
            _api("panews_daily",    fetch_panews_daily)
            _api("sopilot",         fetch_sopilot, C)

        # ── Asian Regional Media ─────────────────────────────────────────────
        if C in ("asia", "all"):
            _rss(_REGIONAL_RSS)

        # ── US / Global Stocks ───────────────────────────────────────────────
        if C in ("stocks", "all"):
            _rss(_STOCKS_RSS)
            _rss(_STOCKS_RSS_EXTRA)
            _rss(_TA_RSS)

        # ── Macro / Forex / Rates ────────────────────────────────────────────
        if C in ("macro", "all"):
            _rss(_CFD_RSS)
            _rss(_TA_RSS)
            _api("wallstcn", fetch_wallstcn)

        # wallstcn also useful for cn_crypto context
        if C in ("cn_crypto",):
            _api("wallstcn", fetch_wallstcn)

        # ── Regulation ───────────────────────────────────────────────────────
        if C in ("regulation", "all"):
            _rss(_REGULATION_RSS)

        # ── Tech / Programming ───────────────────────────────────────────────
        if C in ("tech", "all"):
            _rss(_TECH_RSS)
            _api("github_trending", fetch_github_trending, C)
            _api("hackernews",      fetch_hackernews, days)
            _api("v2ex",            fetch_v2ex, C)

        # ── Social cross-category (all only) ─────────────────────────────────
        if C == "all":
            _api("sopilot", fetch_sopilot, C)
            _api("v2ex",    fetch_v2ex, C)

        if twitter_buddy_dir:
            _api("twitter_buddy", fetch_twitter_buddy, twitter_buddy_dir, days * 24)

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
    p.add_argument("--category",
                   choices=sorted(_VALID_CATEGORIES), default="all",
                   help="Filter by vertical: crypto|defi|web3|cn_crypto|asia|stocks|macro|regulation|tech|all")
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
