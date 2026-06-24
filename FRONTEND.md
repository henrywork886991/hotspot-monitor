# 前端開工指南（給要 port 進 bydfi-ssr 的前端工程師）

> 配合 [HANDOFF.md](HANDOFF.md) 一起看。HANDOFF 講「要不要做/多少成本」;這份講「打開哪個檔、每個元件做什麼、吃什麼資料」,讓你直接動手,不用逆向。

---

## 1. 30 秒架構心智模型

```
Server Page (app/**/page.tsx, force-dynamic / ISR)
   │  直接呼叫 lib/db.ts(SQLite)+ lib/market-extras.ts(讀 data/*.json)
   │  取資料 → 以 props 傳入
   ▼
Client Components ('use client', styled-jsx)
   └─ 互動(載入更多/搜尋/篩選)時 → fetch('/api/news?...')
```

**Port 到 bydfi-ssr 時你只要換兩個接縫:**
1. **取數**:`lib/db.ts` / `lib/market-extras.ts` → 你們的 `Http.getXxx`(打後端 API,形狀見 §4)。
2. **路由/SSR**:`app/**/page.tsx`(App Router server component)→ `.page.tsx` + `getServerSideProps`/你們的 SSR。
**元件本身(18 個)邏輯幾乎不動,只換樣式系統 + 註冊進 componentMap。**

---

## 2. 路由表

| URL | 檔案 | 取數(server) | 主要元件 |
|---|---|---|---|
| `/news` | `app/news/page.tsx` | `queryNews`、`getHotCoins`、`getDipIndex` | CategoryTabs, **NewsFeed** |
| `/news/[category]` | `app/news/[category]/page.tsx` | 同上(+`getCoinPrices`);`markets` 分支走 MarketsFeed | CategoryTabs, NewsFeed / MarketsFeed, CoinChips |
| `/news/[category]/[slug]` | `app/news/[category]/[slug]/page.tsx` | `getNewsById`、`getRelated`、`getCoinPrices` | **ArticleDetail** |
| `/coin/[symbol]` | `app/coin/[symbol]/page.tsx` | `getNewsByCoin`、`getCoinPrice` | **CoinHub** |
| `/dip-index` | `app/dip-index/page.tsx` | `getDipIndex`、`getDipHistory`、`getDipNews`、`getMarkets('cg_losers')`、`getTopIndex` | **DipIndexView** |
| `/top-signal` | `app/top-signal/page.tsx` | `getTopIndex`、`getTopHistory`、`getTopNews` | **TopSignalView** |
| `/api/news` | `app/api/news/route.ts` | — | (給 client 取數,§4) |
| `/api/categories`、`/api/backtest` | `app/api/*/route.ts` | — | 分類計數 / 回測 |
| `/sitemap.xml`、`/robots.txt` | `app/sitemap.ts`、`app/robots.ts` | `getSitemapEntries`、`getHotCoins` | SEO |

> `[slug]` = `<title-slug>-<id>`,用 `idFromSlug()` 解出 id(`lib/site.ts`)。

---

## 3. 元件清單（18 個）

| 元件 | client? | 用途 | 用在 | 重用判斷 |
|---|---|---|---|---|
| **SiteHeader** | ✅ | BYDFi 導航外殼(logo/產品列/主選單/搜尋/登入註冊) | layout | 🔁 **改用你們真實的 nav**,本元件丟棄 |
| **CategoryTabs** | ✅ | 分類分頁列 | news 頁 | 換樣式即可 |
| **NewsFeed** | ✅ | 主 feed:焦點Hero+卡片網格+側欄;載入更多/搜尋/重要性篩選 | /news, /news/[category] | 核心,保留邏輯換樣式 |
| **FeaturedHero** | ✅ | 焦點大卡 | NewsFeed | 換樣式 |
| **NewsCard** | ✅ | 新聞卡(圖/標題/lead/熱詞/幣種徽章) | NewsFeed, CoinHub, ArticleDetail(相關) | 換樣式 |
| **NewsSidebar** | ✅ | 側欄:註冊CTA / 抄底指數卡 / 熱門幣 / 熱門排行 / 活動 / 24-7快訊 | NewsFeed | 角色已對齊你們元件池(Register/Leaderboard/Activities) |
| **TypeFilter** | ✅ | 重要性篩選(全部/緊急/重要/一般/快訊) | NewsFeed | 換樣式 |
| **MarketsFeed** | ✅ | 行情頁:恐懼貪婪banner + 抄底/熱門/領漲三欄 | /news/markets | client 自己 `fetch('/api/news?category=markets')` |
| **FearGreed** | ✅ | 恐懼貪婪儀表 | MarketsFeed | 換樣式 |
| **ArticleDetail** | ✅ | 文章頁:Hero/h1/正文(markdown)/交易chip/熱詞/相關/CTA | 文章頁 | 換樣式 |
| **MarkdownArticle** | ⬜ server | 把 `article_md` 渲染成 HTML | ArticleDetail | 換成你們的 markdown 渲染 |
| **CoinHub** | ✅ | 幣種頁:標頭(現價/交易CTA)+ 新聞網格 | /coin/[symbol] | 換樣式 |
| **CoinChips** | ✅ | 幣種子導航 chips(含現價) | category 頁 | 換樣式 |
| **DipIndexView** | ✅ | 抄底指數頁:儀表/走勢圖/計分卡/抄底榜/抄底新聞/方法論 | /dip-index | 換樣式 |
| **DipChart** | ✅ | SVG 走勢折線圖(純 SVG,無圖表庫) | DipIndexView, TopSignalView | 直接搬 |
| **TopSignalView** | ✅ | 逃頂指數頁(抄底頁的鏡像) | /top-signal | 換樣式 |
| **CycleCrossLink** | ✅ | 抄底↔逃頂互連卡 | DipIndexView, TopSignalView | 換樣式 |
| **BacktestTool** | ✅ | 定投回測(`fetch('/api/backtest')`) | DipIndexView, TopSignalView | client,換樣式 |

> 只有 **MarkdownArticle 是 server component**,其餘 17 個都是 `'use client'`(因為有互動或 styled-jsx)。

---

## 4. 資料契約（最重要 — 你要重接的就是這些形狀）

### 4.1 核心模型 `NewsItem`（`types/index.ts`）
```ts
interface NewsItem {
  id: number; title: string; url: string; source: string;
  category: string; published_at: string | null; fetched_at: string;
  content: string | null; fulltext: string | null;
  importance: 'urgent'|'high'|'medium'|'low'|null;
  summary: string | null; summary_zh: string | null; keywords: string | null;
  symbols: string | null;          // "BTC_USDT,ETH_USDT"(BYDFi 可交易幣對)
  image_url: string | null;
  article_md: string | null; article_title: string | null;  // AI 改寫(原創內容)
  article_score: number | null; article_words: number | null;
}
```

### 4.2 列表 API `/api/news`（client 取數的唯一入口）
```
GET /api/news?category=&importance=&keyword=&page=1&limit=24&hours=72
→ { items: NewsItem[], total: number, page: number, limit: number }
```
- `category`:`all` | `crypto` | `cn_crypto` | `defi` | `markets` | …
- `markets` 分類的 item:`source` 為 `cg_trending|cg_losers|cg_gainers`,`url` 直連 BYDFi 現貨,`content` 形如 `"Price: $… | 24h: …%"`。

### 4.3 指標形狀（`lib/market-extras.ts`,目前讀 `data/*.json`)
```ts
interface DipIndex {
  value: number; label: string; slug: string;
  components: { name: string; desc: string; weight: number; score: number }[];
  news_meta: { fear_headlines: number; total_headlines: number };
  updated: string;
}
interface TopIndex { value; label; slug; triggered_count; total;
  signals: { key; name; category; weight; heat; value; threshold; triggered; detail }[];
  btc_price: number|null; updated: string; }
interface CoinPrice { price: number; pct24h: number|null; name: string; rank: number|null }
interface FearGreed { value:number; classification:string; label_zh:string; prev:number; delta:number; updated:string }
// 走勢: getDipHistory()/getTopHistory() → { date: string; value: number }[]
```

### 4.4 後端要實作的「查詢」（目前是 `lib/db.ts` 的函式 → 換成你們的 API/Http）
| 函式 | 回傳 | 對應頁面 |
|---|---|---|
| `queryNews(opts)` | `{items, total}` | feed / 搜尋 / 篩選 |
| `getNewsById(id)` | `NewsItem` | 文章頁 |
| `getRelated(cat, excludeId)` | `NewsItem[]` | 文章頁「相關」 |
| `getNewsByCoin(base)` | `{items, pair}` | 幣種頁 |
| `getMarkets('cg_losers')` | `NewsItem[]` | 抄底榜 |
| `getDipNews()` / `getTopNews()` | `NewsItem[]` | 抄底/逃頂情報 |
| `getHotCoins()` | `{base,pair,count}[]` | 熱門幣 / sitemap |
| `getSitemapEntries()` | `{id,category,title,…}[]` | sitemap |

→ Port:把這些函式換成 `Http.getXxx`,**回傳形狀維持不變**,元件就不用改。

---

## 5. 樣式 port（styled-jsx → bydfi-ssr）

- 每個元件用 `styled-jsx` 內嵌 CSS(`<style jsx>{styles}</style>`),**已全面使用 BYDFi 設計 tokens**(`--skin-primary-color`、`--spec-background-color-*`、`--color-green/red` 等),色票直接通用。
- 全域樣式在 `app/globals.css`(tokens 定義 + `.sr-only` 等)。
- ⚠️ **待確認**:bydfi-ssr 的樣式方案是 Tailwind / CSS Module / 還是你們自有?確定後逐元件轉。版面數值都在各元件的 `const styles = css\`…\``,照搬即可。

---

## 6. 建議開工順序

1. **先接資料層**:用你們的 Http 實作 §4.4 那幾個查詢(回傳形狀照 §4)。
2. **單頁打通**:先做 `/news`(NewsFeed + NewsCard + NewsSidebar),驗證 feed/側欄/載入更多。
3. **文章頁**:ArticleDetail + MarkdownArticle(`article_md`)+ 交易 chip。
4. **指標頁**:DipIndexView/TopSignalView(讀 §4.3 的 JSON 形狀)+ DipChart 直接搬。
5. **幣種頁 + 行情**:CoinHub、MarketsFeed。
6. **SEO 收尾**:slug 路由、各頁 schema、sitemap/robots(`app/sitemap.ts` 是現成範本)。
7. 全程套你們的 componentMap/serverComponentsMap(用 `bydfi-codegen-ssr-sidebar-pick` skill)。

> SEO 別漏:文章 `NewsArticle`、幣種頁 `CollectionPage`、抄底指數 `Dataset`、全站 `BreadcrumbList` — schema 內容在各 `page.tsx` 的 `jsonLd`,直接抄。
