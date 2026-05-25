# hotspot-monitor

加密貨幣 + 科技熱點監控的 Claude Code Skill，從 **63 個數據源、10 個垂直領域**自動爬取並用 AI 分析。無需任何 API Key。

## 安裝

```bash
# 1. Clone 這個 repo
git clone https://github.com/henrywork886991/hotspot-monitor.git

# 2. 把 skill 文件放到 Claude Code 的 skills 目錄
mkdir -p .claude/skills
cp hotspot-monitor/SKILL.md .claude/skills/hotspot-monitor.md

# 3. 安裝 Python 依賴
pip install -r hotspot-monitor/requirements.txt
```

完成。打開 Claude Code，直接問：

> 「今天幣圈有什麼熱點？」  
> 「幫我搜集美股最新新聞」  
> 「DeFi 鏈上最近有什麼動態？」

---

## 支援的 Category（10 個）

每個 category 只抓對應領域的來源，不會拿到無關的資訊：

| 說法 | Category | 涵蓋來源 | 每次約幾條 |
|------|----------|---------|-----------|
| 加密貨幣、幣圈（廣義） | `crypto` | 英文加密媒體 + 監管 + 中文 + 亞洲 + CoinGecko + DexScreener | ~400 |
| DeFi、去中心化、鏈上數據 | `defi` | Glassnode、IntoTheBlock、Aave、Balancer、Synthetix、Web3 infra、DexScreener | ~120 |
| Web3 基礎設施、L2、zkSync | `web3` | Arbitrum、StarkNet、Optimism、WalletConnect、zkSync、Matter Labs、ENS | ~70 |
| 中文加密、中文幣圈 | `cn_crypto` | PANews、ODaily、BlockTempo、Zombit、SoPilot、36Kr、華爾街見聞 | ~150 |
| 亞洲市場、日本、韓國、台灣 | `asia` | CoinPost JP、CoinDesk JP、TokenPost KR、BlockTempo、Zombit | ~45 |
| 美股、股市、股票 | `stocks` | Yahoo Finance、MarketWatch、CNBC、FT、BBC Business、Investing.com、TradingView | ~91 |
| 外匯、宏觀、總經、利率 | `macro` | FXStreet、ForexLive、TradingView、華爾街見聞 | ~74 |
| 監管、合規、政策 | `regulation` | Coin Center、CoinTelegraph Reg、CryptoNews、Chainalysis | ~25 |
| 科技、程式、AI、開源 | `tech` | TechCrunch、ArsTechnica、The Verge、404 Media、量子位、Dev.to、Lobsters、Product Hunt、Latent Space、GitHub Trending、HackerNews、V2EX | ~141 |
| 全部 | `all` | 所有 63 個來源 | ~692 |

---

## 使用示例

```bash
# 只抓美股新聞
python scripts/collect_trend.py --category stocks

# 只抓中文加密媒體
python scripts/collect_trend.py --category cn_crypto

# DeFi 鏈上數據
python scripts/collect_trend.py --category defi

# 存入資料庫（推薦）
python scripts/collect_trend.py --category stocks | python scripts/save_to_db.py

# 全部來源 + 存庫
python scripts/collect_trend.py --category all | python scripts/save_to_db.py

# 收集 + 同步抓取全文（Jina + trafilatura）
python scripts/collect_trend.py --category crypto --enrich | python scripts/save_to_db.py

# 對 DB 中已存的短內容批次補全文（最多 100 條）
python scripts/enrich_content.py

# 只補特定來源的全文
python scripts/enrich_content.py --source coindesk --limit 50

# 查詢最近 24 小時
python scripts/query_db.py --recent 24

# 關鍵字搜尋
python scripts/collect_keyword.py "Bitcoin ETF" --days 7 | python scripts/save_to_db.py
```

---

## 全文抓取（Fulltext Enrichment）

RSS 訂閱通常只有摘要（100–500 字）。`enrich_content.py` 和 `--enrich` 旗標可以自動補全文：

| 策略 | 說明 |
|------|------|
| **Jina Reader** | `r.jina.ai/{url}` — 支援 JS 渲染，無需 API Key |
| **trafilatura** | 本地 HTML 解析器，Jina 失敗時自動 fallback |

**成功率（實測，2026-05-25）：**

| 來源 | 成功率 | 平均全文長度 |
|------|--------|------------|
| PANews | 100% | 4,500 字 |
| ODaily | 100% | 4,800 字 |
| CoinDesk | ~90% | 8,000 字 |
| Decrypt | ~90% | 8,000 字 |

> 跳過的來源（純 API/社群）：CoinGecko、DexScreener、HackerNews、V2EX、SoPilot Twitter、TradingView、PANews API、華爾街見聞

---

## 數據來源（63 個，無需 API Key）

### `crypto` — 英文加密主流媒體（12 個）
| 來源 | 類型 |
|------|------|
| CoinDesk | RSS |
| Decrypt | RSS |
| The Defiant | RSS |
| CoinTelegraph | RSS |
| CryptoSlate | RSS |
| BeInCrypto | RSS |
| CryptoBriefing | RSS |
| AMBCrypto | RSS |
| Protos | RSS |
| Wu Blockchain | RSS |
| Unchained Crypto | RSS |
| Centrifuge (RWA) | RSS |

### `defi` — DeFi / 鏈上分析（10 個）
| 來源 | 類型 |
|------|------|
| Glassnode Insights | RSS |
| IntoTheBlock | RSS |
| Aave Blog | RSS |
| Balancer Blog | RSS |
| Synthetix | RSS |
| Arbitrum (OffchainLabs) | RSS |
| StarkNet (StarkWare) | RSS |
| Optimism | RSS |
| WalletConnect | RSS |
| zkSync (Mirror) | RSS |
| Matter Labs | RSS |
| DexScreener | API |
| CoinGecko | API |

### `web3` — Web3 基礎設施（9 個）
| 來源 | 類型 |
|------|------|
| Arbitrum | RSS |
| StarkNet | RSS |
| Optimism | RSS |
| WalletConnect | RSS |
| zkSync | RSS |
| Matter Labs | RSS |
| ENS Blog | RSS |
| Glassnode | RSS |
| IntoTheBlock | RSS |

### `cn_crypto` — 中文加密媒體（10 個）
| 來源 | 類型 |
|------|------|
| PANews 最新文章 | API |
| PANews 每日精選 | API |
| ODaily 快訊 | RSS |
| ODaily 深度文章 | RSS |
| 36Kr（中文科技/創業） | RSS |
| SoPilot（Twitter 中文熱推） | RSS |
| BlockTempo（動區動趨） | RSS |
| Zombit（區塊客） | RSS |
| CoinPost JP | RSS |
| CoinDesk Japan | RSS |
| TokenPost KR | RSS |
| 華爾街見聞 | API |

### `asia` — 亞洲區域媒體（5 個）
| 來源 | 類型 |
|------|------|
| CoinPost（日本） | RSS |
| CoinDesk Japan | RSS |
| TokenPost（韓國） | RSS |
| BlockTempo（台灣） | RSS |
| Zombit（台灣） | RSS |

### `stocks` — 美股 / 全球股市（8 個）
| 來源 | 類型 |
|------|------|
| Yahoo Finance | RSS |
| MarketWatch | RSS |
| CNBC Finance | RSS |
| Financial Times Markets | RSS |
| Seeking Alpha | RSS |
| BBC Business | RSS |
| Investing.com | RSS |
| TradingView | RSS |

### `macro` — 外匯 / 宏觀 / 利率（4 個）
| 來源 | 類型 |
|------|------|
| FXStreet | RSS |
| ForexLive | RSS |
| TradingView | RSS |
| 華爾街見聞 | API |

### `regulation` — 監管 / 合規（4 個）
| 來源 | 類型 |
|------|------|
| Coin Center | RSS |
| CoinTelegraph Regulation | RSS |
| CryptoNews | RSS |
| Chainalysis Blog | RSS |

### `tech` — 科技 / 程式（12 個）
| 來源 | 類型 |
|------|------|
| TechCrunch | RSS |
| ArsTechnica | RSS |
| The Verge | RSS |
| 404 Media | RSS |
| 量子位 (QbitAI) | RSS |
| Dev.to | RSS |
| Lobsters | RSS |
| Product Hunt | RSS |
| Latent Space（AI 週報） | RSS |
| GitHub Trending | HTML scrape |
| HackerNews | API |
| V2EX 熱門 | API |

### 選用（需本地設置）
| 來源 | 說明 |
|------|------|
| Twitter Buddy | 需先執行 `collect_twitter.py --login` |

---

## 目錄結構

```
hotspot-monitor/
├── SKILL.md                ← Claude Code skill 文件（放到 .claude/skills/）
├── scripts/
│   ├── collect_trend.py    ← 主要爬取腳本（63 個來源，10 個 category）
│   ├── collect_keyword.py  ← 關鍵字搜尋
│   ├── collect_twitter.py  ← Twitter 瀏覽器爬取（選用）
│   ├── save_to_db.py       ← 儲存到 SQLite
│   ├── enrich_content.py   ← 補全文（Jina Reader + trafilatura fallback）
│   └── query_db.py         ← 查詢歷史數據
├── requirements.txt
├── config.example.json     ← 複製為 config.json 後可自訂
└── references/
    └── sources.md          ← 所有數據源詳細說明
```

---

## 更新

```bash
cd hotspot-monitor && git pull
```
