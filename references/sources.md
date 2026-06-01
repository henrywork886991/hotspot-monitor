# Data Sources Reference

All sources used by the hotspot-monitor skill. Verified as of 2026-05-21.

---

## Crypto News — General

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **CoinDesk** | `coindesk.com/arc/outboundfeeds/rss/` | RSS | None | General |
| **Decrypt** | `decrypt.co/feed` | RSS | None | General |
| **The Defiant** | `thedefiant.io/feed` | RSS | None | DeFi/RWA |
| **CoinTelegraph** | `cointelegraph.com/rss` | RSS | None | General |
| **CryptoSlate** | `cryptoslate.com/feed/` | RSS | None | General |
| **BeInCrypto** | `beincrypto.com/feed/` | RSS | None | General |
| **Wu Blockchain** | `wublock.substack.com/feed` | RSS | None | Industry newsletter |
| **Unchained Crypto** | `unchainedcrypto.com/feed/` | RSS | None | Interviews |
| **Centrifuge** | `medium.com/feed/centrifuge` | RSS | None | RWA/DeFi ⚠️ migrating to Mirror |

## Regulation / Compliance / Policy

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **Coin Center** | `coincenter.org/feed/` | RSS | None | 加密合規/政策 |
| **CoinTelegraph Regulation** | `cointelegraph.com/rss/tag/regulation` | RSS | None | 加密合規/政策 |
| **Cryptonews** | `cryptonews.com/news/feed/` | RSS | None | 加密合規/政策 |
| **Chainalysis** | `blog.chainalysis.com/feed/` | RSS | None | 合規/鏈上分析 |

## On-Chain Analysis / Technical Analysis

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **Glassnode Insights** | `insights.glassnode.com/rss/` | RSS | None | 鏈上技術分析 |
| **IntoTheBlock** | `medium.com/feed/intotheblock` | RSS | None | 鏈上技術分析 |

## Derivatives / Perpetuals

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **Synthetix** | `blog.synthetix.io/rss/` | RSS | None | 衍生品/合約交易 |

## Web3 Infrastructure / L2 / Wallets

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **ENS Blog** | `ens.domains/blog/rss.xml` | Atom | None | 錢包/Web3基礎設施 |
| **Arbitrum (OffchainLabs)** | `medium.com/feed/offchainlabs` | RSS | None | L2基礎設施 |
| **StarkWare** | `medium.com/feed/starkware` | RSS | None | L2/ZK基礎設施 |
| **WalletConnect** | `medium.com/feed/walletconnect` | RSS | None | 錢包/Web3 |
| **Optimism** | `optimism.mirror.xyz/feed/atom` | Atom | None | L2基礎設施 |

## Regional Markets

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **CoinPost (Japan)** | `coinpost.jp/?feed=rss2` | RSS | None | 日本市場 |
| **CoinDesk Japan** | `coindeskjapan.com/feed/` | RSS | None | 日本市場 |

## Tech & AI (Chinese)

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **SoPilot** | `sopilot.net/rss/hottweets` | RSS | None | AI+Crypto Chinese Twitter |
| **V2EX** | `v2ex.com/api/topics/hot.json` | JSON API | None | 中文開發者社群 |
| **Odaily (快訊)** | `rss.odaily.news/rss/newsflash` | RSS | None | 中文幣圈快訊 |
| **Odaily (深度)** | `rss.odaily.news/rss/post` | RSS | None | 中文幣圈深度 |
| **量子位** | `qbitai.com/feed` | RSS | None | 中文AI科技 |

## Tech News

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **TechCrunch** | `techcrunch.com/feed/` | RSS | None | 科技/創業 |
| **ArsTechnica** | `feeds.arstechnica.com/arstechnica/index` | RSS | None | 科技/科學 |
| **The Verge** | `theverge.com/rss/index.xml` | Atom | None | 消費科技 |
| **404 Media** | `404media.co/rss/` | RSS | None | 科技媒體 |

## Community

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **Reddit** | `reddit.com/search.json` | JSON API | None | 英文社群 |

## Market Data APIs

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **CoinGecko** | `api.coingecko.com/api/v3/search/trending` | JSON API | None | 幣種排名/趨勢 |
| **DexScreener** | `api.dexscreener.com/token-boosts/top/v1` | JSON API | None | Meme/鏈上熱點 |

## Prediction Markets

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **Kalshi** | `external-api.kalshi.com/trade-api/v2/markets` | JSON API | None (read) | 預測市場 |
| **Polymarket** | `gamma-api.polymarket.com/markets` | JSON API | None (read) | 預測市場 ⚠️ geo-blocked TW/HK |

## Developer

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **GitHub Trending** | `github.com/trending` | HTML scrape | None | 開源趨勢 |
| **HackerNews** | `hn.algolia.com/api/v1/search` | JSON API | None | 開發者社群 |

## Optional (requires setup)

| Source | URL | Method | Key | Vertical |
|--------|-----|--------|-----|---------|
| **Twitter Buddy** | Local `data/tweets/*.json` | Local files | Twitter login | 自定義關注清單 |
| **Exa API** | `api.exa.ai/search` | JSON API | `EXA_API_KEY` | 索引新聞+推文 |

---

## Scrape Method Legend

- **RSS** — Standard RSS 2.0 `<item>` parsing
- **Atom** — Atom `<entry>` parsing
- **JSON API** — Public REST endpoints
- **HTML scrape** — BeautifulSoup (fragile, check if GitHub changes selectors)
- **Local files** — twitter-buddy `data/tweets/tweets_YYYY-MM-DD.json`

## Notes

- GitHub Trending: only HTML scrape — check CSS selectors if it breaks
- Reddit/V2EX: require valid User-Agent header
- CoinGecko free tier: trending updates every ~15 min; rate limit applies
- DexScreener free tier: 60 req/min (trending), 300 req/min (search)
- Polymarket: geo-blocked in Taiwan/Hong Kong; fetcher silently skips
- Kalshi: US-regulated; public market data readable without key
- Glassnode/CryptoQuant: only blog RSS is free; raw on-chain data API is paid
- Centrifuge Medium RSS: feed still live but blog migrating to Mirror.xyz
