# hotspot-monitor

加密貨幣 + 科技熱點監控的 Claude Code Skill，從 16+ 個數據源自動爬取並用 AI 分析。

## 安裝

```bash
# 1. 在你的專案根目錄 clone 這個 repo
git clone https://github.com/ACCOUNT/hotspot-monitor.git

# 2. 把 skill 文件放到 Claude Code 的 skills 目錄
mkdir -p .claude/skills
cp hotspot-monitor/hotspot-monitor.md .claude/skills/

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

## 數據來源（16+，無需 API Key）

| 類別 | 來源 |
|------|------|
| 加密新聞 | CoinDesk, Decrypt, The Defiant, CoinTelegraph |
| 加密中文 | Wu Blockchain, SoPilot |
| 市場數據 | CoinGecko trending |
| 科技新聞 | TechCrunch, ArsTechnica, The Verge, 404 Media |
| 開發社群 | HackerNews, GitHub Trending, V2EX |
| 英文社群 | Reddit |

**選填：** 設定 `EXA_API_KEY` 可額外搜尋 Twitter 推文和新聞（免費版 1000 次/月，在 [exa.ai](https://exa.ai) 申請）。

---

## 目錄結構

```
hotspot-monitor/
├── hotspot-monitor.md      ← Claude Code skill 文件
├── scripts/
│   ├── collect_trend.py    ← 主要爬取腳本
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
