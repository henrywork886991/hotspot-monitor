---
name: hotspot-monitor
description: >
  Crypto / tech hotspot discovery and analysis with persistent SQLite database.
  Use when asked about: 今天幣圈有什麼熱點, 幫我看看最新科技動態, analyze crypto trends,
  what's trending in AI, 查一下最近熱點, generate hotspot report, 幫我搜尋某個關鍵字的熱點,
  write hotspots to database, query hotspot history, 最近有什麼值得關注的.
---

# Hotspot Monitor — Claude Code Skill

Collect crypto/tech hotspot data from 16+ sources, save to a SQLite database,
and generate AI analysis reports. No extra API keys required for the core features.

## Setup

Assuming you cloned this repo into your project root as `hotspot-monitor/`:

```bash
pip install -r hotspot-monitor/requirements.txt
```

Optional — copy and customize config:
```bash
cp hotspot-monitor/config.example.json hotspot-monitor/config.json
```

## Data Sources

| Source | Method | Category | Notes |
|--------|--------|----------|-------|
| CoinDesk | RSS | Crypto | Free, no key |
| Decrypt | RSS | Crypto | Free, no key |
| The Defiant | RSS | DeFi | Free, no key |
| CoinTelegraph | RSS | Crypto | Free, no key |
| Wu Blockchain | RSS | Crypto (CN) | Free, no key |
| Unchained Crypto | RSS | Crypto | Free, no key |
| TechCrunch | RSS | Tech | Free, no key |
| ArsTechnica | RSS | Tech | Free, no key |
| The Verge | Atom | Tech | Free, no key |
| 404 Media | RSS | Tech | Free, no key |
| GitHub Trending | HTML scrape | Tech | BeautifulSoup |
| HackerNews | JSON API | Tech | Free, no key |
| V2EX | JSON API | Tech (CN) | Free, no key |
| SoPilot | RSS | AI+Crypto (CN) | Free, no key |
| CoinGecko | JSON API | Crypto prices | Free, no key |
| Reddit | JSON API | Community | Free, no key |
| Exa API | JSON API | News+Tweets | Optional — needs `EXA_API_KEY` |

---

## Core Workflow

### 1. Trend Discovery

```bash
# Collect all categories and save to DB
python hotspot-monitor/scripts/collect_trend.py | python hotspot-monitor/scripts/save_to_db.py

# Crypto only
python hotspot-monitor/scripts/collect_trend.py --category crypto | python hotspot-monitor/scripts/save_to_db.py

# Tech only
python hotspot-monitor/scripts/collect_trend.py --category tech | python hotspot-monitor/scripts/save_to_db.py

# Last 1 day only (default: 3 days)
python hotspot-monitor/scripts/collect_trend.py --days 1 | python hotspot-monitor/scripts/save_to_db.py
```

### 2. Keyword Search

```bash
python hotspot-monitor/scripts/collect_keyword.py "Bitcoin ETF" | python hotspot-monitor/scripts/save_to_db.py
python hotspot-monitor/scripts/collect_keyword.py "Claude Sonnet" --days 7
```

Set `EXA_API_KEY` in your environment to also search news and tweets via Exa.

### 3. Query the Database

```bash
# Last 24h, all categories
python hotspot-monitor/scripts/query_db.py --recent 24

# Last 48h, crypto only
python hotspot-monitor/scripts/query_db.py --recent 48 --category crypto

# Search by keyword in title/content
python hotspot-monitor/scripts/query_db.py --keyword "ETF"

# Database stats + run history
python hotspot-monitor/scripts/query_db.py --stats --runs
```

---

## Analysis Framework

After collecting data, analyze each item using this framework:

### Authenticity (`is_real`)
- ✅ **Real**: Specific facts (names, dates, numbers), multiple sources agree, credible outlet
- ⚠️ **Unverified**: Single source, vague claims, no verifiable details
- ❌ **Fake**: Contradicts known facts, sensationalist language with no substance

### Relevance (0–100)
- 80–100: Directly about the topic, key info present
- 50–79: Topic mentioned in meaningful context
- 30–49: Loosely related, same domain
- 0–29: Barely related or misleading

### Importance
- `urgent`: Breaking news, major market event, exploit, product launch
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

SQLite database at `hotspot-monitor/data/hotspots.db` (auto-created on first run):

**`hotspots`** — main content table
```
id, title, content, url (UNIQUE), source, source_type,
category, published_at, importance, summary, keywords,
relevance, is_real, fetched_at
```

**`collection_runs`** — history log
```
id, run_at, category, sources_used, items_fetched, items_new
```

---

## Common Patterns

### Daily briefing
```bash
python hotspot-monitor/scripts/collect_trend.py | python hotspot-monitor/scripts/save_to_db.py
python hotspot-monitor/scripts/query_db.py --recent 24 --pretty
# → analyze the JSON output and generate the trend report
```

### Monitor a specific topic
```bash
python hotspot-monitor/scripts/collect_keyword.py "Solana ETF" --days 7 | python hotspot-monitor/scripts/save_to_db.py
python hotspot-monitor/scripts/query_db.py --keyword "Solana" --recent 168
```

### Weekly summary
```bash
python hotspot-monitor/scripts/query_db.py --recent 168 --category crypto
```
