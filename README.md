# hotspot-monitor

加密貨幣 + 科技熱點監控的 Claude Code Skill，從 **53 個數據源**自動爬取並用 AI 分析。

## 安裝

```bash
# 1. 在你的專案根目錄 clone 這個 repo
git clone https://github.com/henrywork886991/hotspot-monitor.git

# 2. 把 skill 文件放到 Claude Code 的 skills 目錄
mkdir -p .claude/skills
cp hotspot-monitor/SKILL.md .claude/skills/hotspot-monitor.md

# 3. 安裝 Python 依賴
pip install -r hotspot-monitor/requirements.txt
```

完成。打開 Claude Code，直接問：

> 「今天幣圈有什麼熱點？」

---

## 使用示例

| 問法 | 動作 |
|------|------|
| 今天幣圈有什麼熱點？ | 收集 crypto 數據並生成分析報告 |
| 幫我看最新科技動態 | 收集 tech 數據並分析 |
| 搜尋 Bitcoin ETF 最近 7 天 | 跨平台關鍵字搜尋 |
| 查一下資料庫裡最近 24 小時的熱點 | 查詢已儲存的歷史數據 |
| 上週 Solana 的討論熱度如何？ | 週維度熱點回顧 |

---

## 數據來源（53 個，無需 API Key）

### 加密主流媒體（英文）
| 來源 | 類型 |
|------|------|
| CoinDesk | RSS |
| Decrypt | RSS |
| The Defiant | RSS |
| CoinTelegraph | RSS |
| CoinTelegraph Regulation | RSS |
| CryptoSlate | RSS |
| BeInCrypto | RSS |
| CryptoBriefing | RSS |
| AMBCrypto | RSS |
| Protos | RSS |
| CryptoNews | RSS |
| Unchained Crypto | RSS |

### 加密中文媒體
| 來源 | 類型 |
|------|------|
| PANews 最新文章 | API |
| PANews 每日精選 | API |
| ODaily 快訊 | RSS |
| ODaily 文章 | RSS |
| Wu Blockchain | RSS |
| SoPilot (Twitter 熱推) | RSS |
| BlockTempo (動區動趨) | RSS |
| Zombit (區塊客) | RSS |

### 亞洲區域媒體
| 來源 | 類型 |
|------|------|
| CoinPost（日本） | RSS |
| CoinDesk Japan | RSS |
| TokenPost（韓國） | RSS |

### 市場數據 & 鏈上
| 來源 | 類型 |
|------|------|
| CoinGecko Trending Coins | API |
| CoinGecko Top Exchanges | API |
| DexScreener Boosted Tokens | API |
| Glassnode Insights | RSS |
| IntoTheBlock | RSS |

### 監管 & 合規
| 來源 | 類型 |
|------|------|
| Coin Center | RSS |
| Chainalysis Blog | RSS |

### Web3 基礎設施
| 來源 | 類型 |
|------|------|
| Arbitrum (OffchainLabs) | RSS |
| StarkNet (StarkWare) | RSS |
| Optimism | RSS |
| WalletConnect | RSS |
| ENS Blog | RSS |
| Synthetix | RSS |
| Centrifuge (RWA/DeFi) | RSS |

### 宏觀金融
| 來源 | 類型 |
|------|------|
| MarketWatch | RSS |
| CNBC Finance | RSS |
| Financial Times Markets | RSS |
| Seeking Alpha | RSS |
| FXStreet | RSS |
| ForexLive | RSS |
| TradingView | RSS |

### 科技媒體
| 來源 | 類型 |
|------|------|
| TechCrunch | RSS |
| ArsTechnica | RSS |
| The Verge | RSS |
| 404 Media | RSS |
| 量子位 (QbitAI) | RSS |

### 開發社群
| 來源 | 類型 |
|------|------|
| HackerNews | API |
| GitHub Trending | HTML scrape |
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
│   ├── collect_trend.py    ← 主要爬取腳本（53 個來源）
│   ├── collect_keyword.py  ← 關鍵字搜尋
│   ├── collect_twitter.py  ← Twitter 瀏覽器爬取（選用）
│   ├── save_to_db.py       ← 儲存到 SQLite
│   └── query_db.py         ← 查詢歷史數據
├── requirements.txt
├── config.example.json     ← 複製為 config.json 後可自訂
└── references/
    └── sources.md          ← 所有數據源詳細說明
```

## 更新

```bash
cd hotspot-monitor && git pull
```
