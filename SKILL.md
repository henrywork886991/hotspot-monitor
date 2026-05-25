---
name: hotspot-monitor
description: >
  Crypto / tech hotspot discovery and analysis with persistent SQLite database.
  Use when asked about: 今天幣圈有什麼熱點, 幫我看看最新科技動態, analyze crypto trends,
  what's trending in AI, 查一下最近熱點, generate hotspot report, 幫我搜尋某個關鍵字的熱點,
  write hotspots to database, query hotspot history, 最近有什麼值得關注的,
  美股最新新聞, 中文加密媒體, DeFi鏈上動態, Web3基礎設施, 監管合規新聞,
  外匯宏觀動態, 亞洲加密市場, help me collect stocks news, defi news today.
---

# Hotspot Monitor — Claude Code Skill

Collect crypto/tech hotspot data from **57 個數據源**，支援 10 個獨立 category，
存入 SQLite 資料庫，並用 AI 生成分析報告。無需額外 API Key。

## Quick Start

```bash
pip install requests beautifulsoup4
```

## Category → 用戶意圖對照表

**收到用戶請求時，先依下表映射 category，再執行對應的 collect 指令：**

| 用戶說... | Category | 說明 |
|----------|----------|------|
| 美股/股市/股票/美國市場/US stocks | `stocks` | Yahoo Finance, MarketWatch, CNBC, FT, BBC Business, Investing.com, TradingView |
| 外匯/總經/宏觀/Forex/Fed/利率/匯率 | `macro` | FXStreet, ForexLive, TradingView |
| DeFi/去中心化/鏈上/鏈上數據/on-chain | `defi` | Glassnode, IntoTheBlock, Synthetix, Aave, Balancer, DexScreener, CoinGecko, web3 infra |
| Web3基礎設施/L2/Layer2/zkSync/Arbitrum/Optimism/Base | `web3` | Arbitrum, StarkNet, Optimism, WalletConnect, zkSync, Matter Labs, ENS, Glassnode |
| 中文幣圈/中文加密/中國區塊鏈 | `cn_crypto` | PANews, ODaily, BlockTempo, Zombit, SoPilot, 亞洲各地媒體 |
| 亞洲市場/日本/韓國/台灣 | `asia` | CoinPost JP, CoinDesk JP, TokenPost KR, BlockTempo, Zombit |
| 監管/合規/政策/立法/regulation | `regulation` | Coin Center, CoinTelegraph Reg, CryptoNews, Chainalysis |
| 科技/程式/AI/開源/GitHub/HackerNews | `tech` | TechCrunch, ArsTechnica, The Verge, 404Media, 量子位, GitHub Trending, HackerNews, V2EX |
| 加密貨幣/幣圈/crypto（廣義）| `crypto` | 所有英文加密媒體 + 監管 + 中文媒體 + 亞洲 + CoinGecko + DexScreener |
| 全部/最新熱點/什麼都要 | `all` | 所有 57 個來源 |

## Data Sources（57 個）

### `crypto` — 英文加密主流媒體
| 來源 | 方法 |
|------|------|
| CoinDesk, Decrypt, The Defiant, CoinTelegraph | RSS |
| CryptoSlate, BeInCrypto, CryptoBriefing, AMBCrypto, Protos | RSS |
| Wu Blockchain, Unchained Crypto, Centrifuge (RWA) | RSS |
| CoinGecko Trending Coins + Exchanges | API |
| DexScreener Boosted Tokens | API |

### `defi` — DeFi / 鏈上分析
| 來源 | 方法 |
|------|------|
| Glassnode Insights, IntoTheBlock | RSS |
| Aave Blog, Balancer Blog, Synthetix | RSS |
| Arbitrum, StarkNet, Optimism, WalletConnect, zkSync, Matter Labs | RSS |
| DexScreener, CoinGecko | API |

### `web3` — Web3 基礎設施
| 來源 | 方法 |
|------|------|
| Arbitrum, StarkNet, Optimism, WalletConnect | RSS |
| zkSync (Mirror), Matter Labs | RSS |
| ENS Blog, Glassnode, IntoTheBlock | RSS |

### `cn_crypto` — 中文加密媒體
| 來源 | 方法 |
|------|------|
| PANews 最新文章 + 每日精選 | API |
| ODaily 快訊 + 深度文章 | RSS |
| SoPilot (Twitter 中文熱推) | RSS |
| BlockTempo (動區), Zombit (區塊客) | RSS |
| CoinPost JP, CoinDesk JP, TokenPost KR | RSS |

### `asia` — 亞洲區域媒體
| 來源 | 方法 |
|------|------|
| CoinPost (日本), CoinDesk Japan | RSS |
| TokenPost (韓國), BlockTempo, Zombit | RSS |

### `stocks` — 美股/全球股市
| 來源 | 方法 |
|------|------|
| Yahoo Finance, MarketWatch, CNBC Finance | RSS |
| Financial Times Markets, Seeking Alpha | RSS |
| BBC Business, Investing.com | RSS |
| TradingView | RSS |

### `macro` — 外匯/宏觀/利率
| 來源 | 方法 |
|------|------|
| FXStreet, ForexLive | RSS |
| TradingView | RSS |

### `regulation` — 監管/合規
| 來源 | 方法 |
|------|------|
| Coin Center, CoinTelegraph Regulation | RSS |
| CryptoNews, Chainalysis Blog | RSS |

### `tech` — 科技/程式
| 來源 | 方法 |
|------|------|
| TechCrunch, ArsTechnica, The Verge, 404 Media, 量子位 | RSS |
| GitHub Trending | HTML scrape (需 beautifulsoup4) |
| HackerNews, V2EX | API |

---

## Core Workflow

### 1. Trend Discovery（依 category 抓取）

```bash
# 只抓美股新聞
python scripts/collect_trend.py --category stocks

# 只抓中文加密媒體
python scripts/collect_trend.py --category cn_crypto

# DeFi/鏈上數據
python scripts/collect_trend.py --category defi

# 存入資料庫（推薦）
python scripts/collect_trend.py --category stocks | python scripts/save_to_db.py

# With English Twitter (requires twitter-buddy running)
python scripts/collect_trend.py --category all \
  --twitter-buddy-dir ~/twitter-buddy/data/tweets/ | python scripts/save_to_db.py
```

### 2. Keyword Search

Search a specific term across HackerNews, Reddit, and optionally Exa:

```bash
python scripts/collect_keyword.py "Bitcoin ETF" | python scripts/save_to_db.py
python scripts/collect_keyword.py "Claude Sonnet" --days 7
```

### 3. Query the Database

```bash
# Last 24h, all categories
python scripts/query_db.py --recent 24

# Last 48h, crypto only
python scripts/query_db.py --recent 48 --category crypto

# Filter by source
python scripts/query_db.py --source coindesk --recent 24

# Search by keyword in title/content
python scripts/query_db.py --keyword "ETF"

# Database stats
python scripts/query_db.py --stats

# Collection run history
python scripts/query_db.py --runs
```

---

## Analysis Framework

After collecting data, analyze it yourself using this framework for each item:

### Authenticity (`is_real`)
- ✅ **Real**: Specific facts (names, dates, numbers), multiple sources agree, credible outlet
- ⚠️ **Unverified**: Single source, vague claims, no verifiable details
- ❌ **Fake**: Contradicts known facts, sensationalist language with no substance, clear marketing

### Relevance (0–100)
- 80–100: Directly about the topic, key information present
- 50–79: Topic mentioned in meaningful context
- 30–49: Loosely related, same domain but not the focus
- 0–29: Barely related or misleading

### Importance
- `urgent`: Breaking news, major market event, security exploit, product launch
- `high`: Significant development that changes the landscape
- `medium`: Relevant update worth tracking
- `low`: Background info, minor update

---

## Report Templates

### Trend Report

```markdown
# 熱點分析報告 — {category} | {date}
> 資料來源：{sources} | 共 {count} 筆

## 執行摘要
（3–5 句話，最重要的發現 + 整體可信度）

## 關鍵熱點
每條格式：
### 🚨/🔴/🟡/🟢 [重要性] ✅/⚠️/❌ [真實性] 標題
**摘要：** （說明背景和為何重要，不要只複製標題）
**查核：** （為何可信或存疑）
來源：`source_name` | [原文](url)

## 趨勢分析
- 主要討論方向：...
- 社群情緒：...
- 值得持續追蹤：...

## 來源統計
| 平台 | 筆數 |
|------|------|
```

### Keyword Search Report

```markdown
# 搜尋報告 — "{keyword}" | {date}
> 搜尋範圍：最近 {days} 天 | 共 {count} 筆

## 最相關結果（相關性 > 60）
...

## 其他相關（相關性 30–60）
...

## 可信度總覽
✅ 可信 X 條 / ⚠️ 待查 Y 條 / ❌ 疑似不實 Z 條
```

---

## Database Schema

The SQLite database (`data/hotspots.db`) has two tables:

**`hotspots`** — main content table
```
id, title, content, url (UNIQUE), source, source_type,
category, published_at, importance, summary, keywords,
relevance, is_real, fetched_at
```

**`collection_runs`** — collection history log
```
id, run_at, category, sources_used, items_fetched, items_new
```

After analysis, you can update the DB with your assessments:
```python
import sqlite3
conn = sqlite3.connect("data/hotspots.db")
conn.execute(
    "UPDATE hotspots SET importance=?, summary=?, relevance=?, is_real=? WHERE url=?",
    ("high", "One-sentence summary", 85, 1, "https://...")
)
conn.commit()
```

---

## Common Patterns

### Daily briefing
```bash
python scripts/collect_trend.py | python scripts/save_to_db.py
python scripts/query_db.py --recent 24 --pretty
# → analyze the JSON output and generate the trend report
```

### Monitor a specific topic
```bash
python scripts/collect_keyword.py "Solana ETF" --days 7 | python scripts/save_to_db.py
python scripts/query_db.py --keyword "Solana" --recent 168
# → analyze for relevance and authenticity
```

### Weekly summary
```bash
python scripts/query_db.py --recent 168 --category crypto
# → summarize the week's crypto hotspots from the database
```

### Check DB health
```bash
python scripts/query_db.py --stats --runs
```
