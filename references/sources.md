# Data Sources Reference

All sources used by the hotspot-monitor skill, including scrape method and requirements.

## Crypto Sources

| Source | URL | Method | API Key | Update Freq | Focus |
|--------|-----|--------|---------|-------------|-------|
| **CoinDesk** | `coindesk.com/arc/outboundfeeds/rss/` | RSS | None | ~1h | Crypto news |
| **Decrypt** | `decrypt.co/feed` | RSS | None | ~2h | Crypto/Web3 |
| **The Defiant** | `thedefiant.io/feed` | RSS | None | ~2h | DeFi focused |
| **CoinTelegraph** | `cointelegraph.com/rss` | RSS | None | ~1h | Crypto news |
| **CoinGecko** | `api.coingecko.com/api/v3/search/trending` | JSON API | None | Real-time | Trending coins |

## Tech Sources

| Source | URL | Method | API Key | Update Freq | Focus |
|--------|-----|--------|---------|-------------|-------|
| **TechCrunch** | `techcrunch.com/feed/` | RSS | None | ~2h | Startup/Tech |
| **ArsTechnica** | `feeds.arstechnica.com/arstechnica/index` | RSS | None | ~2h | Tech/Science |
| **The Verge** | `theverge.com/rss/index.xml` | Atom | None | ~1h | Consumer tech |
| **404 Media** | `404media.co/rss/` | RSS | None | ~4h | Tech journalism |
| **GitHub Trending** | `github.com/trending` | **HTML scrape** | None | Daily | Open source |
| **HackerNews** | `hn.algolia.com/api/v1/search` | JSON API | None | Real-time | Dev community |

## Community Sources

| Source | URL | Method | API Key | Update Freq | Focus |
|--------|-----|--------|---------|-------------|-------|
| **SoPilot** | `sopilot.net/rss/hottweets` | RSS | None | ~1h | Chinese Twitter (AI+Crypto) |
| **V2EX** | `v2ex.com/api/topics/hot.json` | JSON API | None | ~1h | Chinese dev community |
| **Reddit** | `reddit.com/search.json` | JSON API | None | Real-time | English community |

## Optional Sources

| Source | URL | Method | API Key | Update Freq | Focus |
|--------|-----|--------|---------|-------------|-------|
| **Exa (tweets)** | `api.exa.ai/search` | JSON API | `EXA_API_KEY` | Real-time | Indexed English tweets |
| **Exa (news)** | `api.exa.ai/search` | JSON API | `EXA_API_KEY` | Real-time | Indexed news |
| **Twitter Buddy** | Local `data/tweets/*.json` | **Local files** | Twitter login | ~10-45 min | Personal Following timeline |

## Scrape Method Legend

- **RSS** — Parse standard RSS 2.0 `<item>` elements. Title, link, description, pubDate.
- **Atom** — Parse Atom feed `<entry>` elements. Same schema, different tag names.
- **JSON API** — Official or public JSON endpoints. No HTML parsing needed.
- **HTML scrape** — Use BeautifulSoup to parse page DOM. Fragile, may break on site redesigns.
- **Local files** — Read from twitter-buddy's `data/tweets/tweets_YYYY-MM-DD.json`.

## Notes

- GitHub Trending is the only HTML scrape — if it breaks, check if GitHub changed their CSS selectors
- Reddit and V2EX require a valid User-Agent header
- CoinGecko free tier has rate limits; the trending endpoint is updated every 10-15 minutes
- SoPilot RSS returns mixed AI + crypto content; category filtering is done via regex
