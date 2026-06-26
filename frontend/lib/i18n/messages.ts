import { type Locale, DEFAULT_LOCALE } from './config';

/* UI string dictionary. Flat dot-keys; `t()` does lookup + {var} interpolation.
   Missing keys fall back to the default locale, then to the key itself. */
type Dict = Record<string, string>;

const zh: Dict = {
  'site.title': 'BYDFi Crypto News — 加密貨幣熱點、幣種新聞與市場分析',
  'site.description': '即時監控 90+ 數據源的加密貨幣、DeFi、美股、宏觀與科技熱點新聞。',

  // SiteHeader
  'header.search': '搜尋新聞、幣種、關鍵字…（Enter 搜尋）',

  // CategoryTabs
  'nav.all': '全部',
  'nav.altcoin': '山寨幣',
  'nav.more': '更多',

  // NewsFeed
  'feed.searchResults': '「{kw}」搜尋結果：{n} 條',
  'feed.count': '共 {n} 條（最近72小時）',
  'feed.emptySearch': '找不到符合「{kw}」的新聞',
  'feed.emptyData': '暫無資料，請先執行資料收集腳本',
  'feed.loadMore': '查看更多',
  'feed.h1': '加密貨幣、DeFi、美股與科技熱點新聞 — 即時市場動態',
  'feed.h1Search': '「{kw}」搜尋結果',
  'feed.catH1': '{label} 熱點新聞 — 最新市場動態與分析',
  'meta.catTitle': '{label} 熱點 — Hotspot Monitor',
  'meta.catDesc': '最新 {label} 相關新聞與熱點分析',

  // FeaturedHero / NewsCard
  'hero.featured': '焦點',
  'card.coinTitle': '{c} 相關新聞與交易',

  // TypeFilter
  'filter.all': '全部',
  'filter.urgent': '🚨 緊急',
  'filter.high': '🔴 重要',
  'filter.medium': '🟡 一般',
  'filter.low': '⚪ 快訊',

  // NewsSidebar
  'sidebar.signupTitle': '新用戶專屬',
  'sidebar.signupAmount': '註冊即領 $5 體驗金',
  'sidebar.signupDesc': '在 BYDFi 交易 400+ 幣種，現貨、合約、跟單一站搞定。',
  'sidebar.signupCta': '免費註冊 →',
  'sidebar.dipTitle': 'BYDFi 抄底指數',
  'sidebar.dipCta': '查看完整指數 →',
  'sidebar.topTitle': 'BYDFi 逃頂指數',
  'sidebar.topCta': '查看頂部訊號 →',
  'sidebar.hotCoins': '🔥 熱門幣種',
  'sidebar.hotRank': '🔥 熱門排行',
  'sidebar.noHot': '暫無熱門',
  'sidebar.activities': '🎁 活動專區',
  'sidebar.liveFlash': '24/7 快訊',
  'sidebar.noFlash': '暫無快訊',
  'sidebar.triggeredSuffix': '觸發',
  'sidebar.act1Title': '新用戶任務中心 — 完成任務領 $5,050 獎勵',
  'sidebar.act1Tag': '新人福利',
  'sidebar.act2Title': '合約交易大賽 — 瓜分 $100,000 獎池',
  'sidebar.act2Tag': '限時賽事',
  'sidebar.act3Title': 'BYDFi Card — 加密貨幣消費最高 8% 返現',
  'sidebar.act3Tag': '熱門',

  // MarketsFeed
  'markets.title': '行情數據',
  'markets.subtitle': 'BYDFi 可交易幣種的即時行情 · 點任一幣種直接前往 BYDFi 現貨交易',
  'markets.loading': '載入中…',
  'markets.empty': '暫無數據',
  'markets.dip': '🩸 今日抄底榜',
  'markets.hot': '🔥 熱門幣種',
  'markets.gainers': '🚀 今日領漲榜',
  'markets.dipSub': '24h 跌幅最深',
  'markets.hotSub': 'Trending',
  'markets.gainersSub': '24h 漲幅最高',

  // FearGreed
  'fg.label': '恐懼貪婪指數',
  'fg.vsYesterday': 'vs 昨日',
  'fg.extremeFear': '市場極度恐懼 — 歷史上的抄底區間',
  'fg.fear': '市場偏向恐懼 — 留意逢低布局機會',
  'fg.neutral': '市場情緒中性',
  'fg.greed': '市場偏向貪婪 — 注意追高風險',
  'fg.extremeGreed': '市場極度貪婪 — 小心追高',

  // ArticleDetail
  'article.aiNote': 'AI 編譯整理',
  'article.aiNoteDesc': '重點摘要與結構化重寫，原文出處見文末',
  'article.tradeHeader': '💱 本文相關幣種 — 在 BYDFi 交易',
  'article.tradeSub': 'AI 從內文辨識、並比對 BYDFi 支援的現貨幣對，點擊直接前往交易',
  'article.ctaTitle': '在 BYDFi 交易 400+ 幣種',
  'article.ctaSub': '現貨、合約、跟單一站搞定 — 註冊即領 $5 體驗金',
  'article.ctaBtn': '免費註冊 →',
  'article.related': '相關新聞',
  'article.originNote': '本文重點由 BYDFi Crypto News 整理彙編，完整內容請見原始來源 {source}。',
  'article.readOriginal': '閱讀原文 ↗',
  'article.tradeGo': '交易 →',
  'article.translating': '完整英文版正在生成中，以下為重點摘要；完整內容請見原文。',

  // CoinHub
  'coin.title': '{name} 最新新聞與分析',
  'coin.subtitle': '{base} · 共 {count} 篇相關報導（最近72小時）',
  'coin.tradeBtn': '在 BYDFi 交易 {pair} →',
  'coin.faqHeader': '關於 {name}（{base}）的常見問題',

  // CoinChips
  'chips.title': '🔥 {label} 熱門幣種',
  'chips.subtitle': '點任一幣種查看聚合新聞與即時行情',

  // DipChart / TopChart zones
  'chart.dipAria': 'BYDFi 抄底指數走勢',
  'chart.dipZone1': '≥75 強烈抄底',
  'chart.dipZone2': '60–75 抄底區間',
  'chart.dipZone3': '45–60 中性',
  'chart.dipZone4': '<45 偏熱/貪婪',

  // DipIndexView
  'dip.chartHeader': '指數走勢（近 {n} 天）',
  'dip.streak': '已連續 {n} 天處於抄底區間（≥60）',
  'dip.componentsHeader': '指數構成（透明計分）',
  'dip.componentsSub': '{n} 項訊號加權合成（鏈上估值 · 技術 · 情緒 · 新聞），分數越高代表越偏向「恐懼／超賣／抄底」',
  'dip.backtestTitle': '多賺多少？',
  'dip.backtestSub': '回溯歷史 BTC 行情：如果當時按抄底訊號進場，你今天會多賺多少。',
  'dip.losersHeader': '🩸 抄底幣種榜（24h 跌幅最深）',
  'dip.losersSub': 'BYDFi 可交易幣種 · 點擊直接前往現貨交易',
  'dip.newsHeader': '📰 抄底情報',
  'dip.newsSub': '市場回調、增持、超賣相關新聞',
  'dip.methodology': '方法論',
  'dip.title': 'BYDFi 抄底指數',
  'dip.updated': '更新時間：{time}（每 2 小時自動計算）',
  'dip.vsYesterday': '較昨日',
  'dip.recentRange': '近期指數區間變化',
  'dip.methodologyProse': 'BYDFi 抄底指數是 BYDFi News 自有的複合訊號，把多方數據整合為單一 0–100 指標，涵蓋四個維度：鏈上估值（MVRV Z-Score、NUPL 淨未實現損益）、技術面（BTC 距歷史高點回調、200 日均線偏離、14 日 RSI 超賣）、市場情緒（恐懼貪婪指數、永續資金費率），以及我們獨家的新聞恐慌度（近 24 小時崩跌類新聞佔比）。各項標準化後加權合成，分數越高代表市場越偏向恐懼/超賣，歷史上常對應較佳的累積區間。資料來源：bitcoin-data.com（鏈上）、Alternative.me、CoinGecko、Binance 與 BYDFi News 新聞流。',
  'dip.disclaimer': '⚠️ 本指數僅供市場參考與教育用途，不構成投資建議。加密貨幣價格波動劇烈，請自行研究並評估風險。',

  // TopSignalView
  'top.triggered': '觸發訊號 {a} / {b}',
  'top.chartHeader': '指數走勢（近 {n} 天）',
  'top.streak': '已連續 {n} 天處於逃頂區間（≥60）',
  'top.signalsHeader': '{n} 項核心逃頂訊號',
  'top.signalsSub': '逐項對照「觸頂閾值」判定 觸/未觸；分數越高代表越接近週期頂部。共 {n} 項已觸發。',
  'top.backtestTitle': '少虧多少？',
  'top.backtestSub': '回溯歷史 BTC 行情：如果當時按逃頂訊號離場，你今天會少虧多少。',
  'top.gainersHeader': '🚀 過熱幣種榜（24h 漲幅最高）',
  'top.gainersSub': 'BYDFi 可交易幣種 · 漲多回調風險高，點擊查看行情',
  'top.newsHeader': '📰 過熱情報',
  'top.newsSub': '創新高、FOMO、過熱相關新聞',
  'top.methodology': '方法論',
  'top.title': 'BYDFi 逃頂指數',
  'top.updated': '更新時間：{time}（每 2 小時自動計算）',
  'top.vsYesterday': '較昨日',
  'top.recentRange': '近期指數區間變化',
  'top.methodologyProse': 'BYDFi 逃頂指數是 BYDFi News 自有的複合訊號，把頂部專屬指標整合為單一 0–100 指標，並逐項列出是否觸發「觸頂閾值」。涵蓋：鏈上估值（MVRV Z-Score、NUPL、Puell Multiple）、週期模型（Pi Cycle 頂部信號、Mayer Multiple）、市場情緒（恐懼貪婪指數）、衍生品（永續資金費率）、市場結構（BTC 占有率反轉），以及我們獨家的新聞狂熱度（近 24 小時創新高/FOMO 類新聞佔比）。這不是抄底指數的反向，而是一組獨立的頂部訊號；分數越高、觸發項越多，代表越接近週期頂部、越值得考慮分批獲利了結。資料來源：bitcoin-data.com（鏈上）、Alternative.me、CoinGecko、Binance 與 BYDFi News 新聞流。',
  'top.disclaimer': '⚠️ 本指數僅供市場參考與教育用途，不構成投資建議。加密貨幣價格波動劇烈，請自行研究並評估風險。',
  'top.triggeredBadge': '觸發',
  'top.notTriggeredBadge': '未觸',

  // CycleCrossLink
  'cross.view': '查看 →',

  // BacktestTool
  'bt.dateSell': '清倉日期',
  'bt.dateBuy': '抄底日期',
  'bt.amount': '金額（USD）',
  'bt.running': '推演中…',
  'bt.run': '推演 →',
  'bt.errNoPrice': '暫時取不到該日價格，請稍後再試或換個日期',
  'bt.errBadInput': '查詢失敗，請確認日期與金額',
  'bt.errGeneric': '查詢失敗，請稍後再試',
};

const en: Dict = {
  'site.title': 'BYDFi Crypto News — Crypto Headlines, Coin News & Market Analysis',
  'site.description': 'Real-time crypto, DeFi, equities, macro & tech news aggregated from 90+ sources.',

  'header.search': 'Search news, coins, keywords… (press Enter)',

  'nav.all': 'All',
  'nav.altcoin': 'Altcoins',
  'nav.more': 'More',

  'feed.searchResults': '{n} results for “{kw}”',
  'feed.count': '{n} stories (last 72h)',
  'feed.emptySearch': 'No news found for “{kw}”',
  'feed.emptyData': 'No data yet — run the collection script first',
  'feed.loadMore': 'Load more',
  'feed.h1': 'Crypto, DeFi, Equities & Tech Headlines — Live Market Updates',
  'feed.h1Search': 'Search results for “{kw}”',
  'feed.catH1': '{label} Headlines — Latest Market Updates & Analysis',
  'meta.catTitle': '{label} News — Hotspot Monitor',
  'meta.catDesc': 'Latest {label} news and hotspot analysis',

  'hero.featured': 'Featured',
  'card.coinTitle': '{c} news & trading',

  'filter.all': 'All',
  'filter.urgent': '🚨 Urgent',
  'filter.high': '🔴 Important',
  'filter.medium': '🟡 Normal',
  'filter.low': '⚪ Flash',

  'sidebar.signupTitle': 'New users',
  'sidebar.signupAmount': 'Get a $5 trial bonus on sign-up',
  'sidebar.signupDesc': 'Trade 400+ coins on BYDFi — spot, futures and copy trading in one place.',
  'sidebar.signupCta': 'Sign up free →',
  'sidebar.dipTitle': 'BYDFi Dip Index',
  'sidebar.dipCta': 'View full index →',
  'sidebar.topTitle': 'BYDFi Top Index',
  'sidebar.topCta': 'View top signals →',
  'sidebar.hotCoins': '🔥 Trending coins',
  'sidebar.hotRank': '🔥 Top mentioned',
  'sidebar.noHot': 'Nothing trending',
  'sidebar.activities': '🎁 Promotions',
  'sidebar.liveFlash': '24/7 Newsflash',
  'sidebar.noFlash': 'No flashes yet',
  'sidebar.triggeredSuffix': 'triggered',
  'sidebar.act1Title': 'New-user task center — earn up to $5,050',
  'sidebar.act1Tag': 'New users',
  'sidebar.act2Title': 'Futures trading contest — share a $100,000 pool',
  'sidebar.act2Tag': 'Limited event',
  'sidebar.act3Title': 'BYDFi Card — up to 8% cashback on crypto spending',
  'sidebar.act3Tag': 'Popular',

  'markets.title': 'Market Data',
  'markets.subtitle': 'Live prices for BYDFi-tradeable coins · tap any coin to trade spot on BYDFi',
  'markets.loading': 'Loading…',
  'markets.empty': 'No data',
  'markets.dip': '🩸 Biggest dips today',
  'markets.hot': '🔥 Trending coins',
  'markets.gainers': '🚀 Top gainers today',
  'markets.dipSub': 'Biggest 24h drop',
  'markets.hotSub': 'Trending',
  'markets.gainersSub': 'Biggest 24h gain',

  'fg.label': 'Fear & Greed Index',
  'fg.vsYesterday': 'vs yesterday',
  'fg.extremeFear': 'Extreme fear — historically a buy-the-dip zone',
  'fg.fear': 'Leaning fearful — watch for accumulation opportunities',
  'fg.neutral': 'Neutral market sentiment',
  'fg.greed': 'Leaning greedy — mind the chase-high risk',
  'fg.extremeGreed': 'Extreme greed — careful chasing highs',

  'article.aiNote': 'AI-compiled',
  'article.aiNoteDesc': 'Summarized and restructured; original source linked below',
  'article.tradeHeader': '💱 Coins in this story — trade on BYDFi',
  'article.tradeSub': 'AI-detected from the article and matched to BYDFi spot pairs; tap to trade',
  'article.ctaTitle': 'Trade 400+ coins on BYDFi',
  'article.ctaSub': 'Spot, futures & copy trading — get a $5 trial bonus on sign-up',
  'article.ctaBtn': 'Sign up free →',
  'article.related': 'Related news',
  'article.originNote': 'Compiled by BYDFi Crypto News; for the full story see the original source {source}.',
  'article.readOriginal': 'Read original ↗',
  'article.tradeGo': 'Trade →',
  'article.translating': 'The full English version is being generated; a summary is shown below — see the original for the full story.',

  'coin.title': '{name} Latest News & Analysis',
  'coin.subtitle': '{base} · {count} related stories (last 72h)',
  'coin.tradeBtn': 'Trade {pair} on BYDFi →',
  'coin.faqHeader': 'Frequently asked about {name} ({base})',

  'chips.title': '🔥 {label} trending coins',
  'chips.subtitle': 'Tap any coin for aggregated news and live prices',

  'chart.dipAria': 'BYDFi Dip Index trend',
  'chart.dipZone1': '≥75 strong dip',
  'chart.dipZone2': '60–75 dip zone',
  'chart.dipZone3': '45–60 neutral',
  'chart.dipZone4': '<45 hot/greedy',

  'dip.chartHeader': 'Index trend (last {n} days)',
  'dip.streak': '{n} days running in the dip zone (≥60)',
  'dip.componentsHeader': 'Index composition (transparent scoring)',
  'dip.componentsSub': '{n} weighted signals (on-chain valuation · technicals · sentiment · news); a higher score means more fear / oversold / dip-worthy',
  'dip.backtestTitle': 'How much more would you have made?',
  'dip.backtestSub': 'Backtest historical BTC: if you had bought on the dip signal then, how much more you would have today.',
  'dip.losersHeader': '🩸 Dip leaderboard (biggest 24h drops)',
  'dip.losersSub': 'BYDFi-tradeable coins · tap to trade spot',
  'dip.newsHeader': '📰 Dip intel',
  'dip.newsSub': 'Pullback, accumulation and oversold news',
  'dip.methodology': 'Methodology',
  'dip.title': 'BYDFi Dip Index',
  'dip.updated': 'Updated: {time} (recalculated every 2h)',
  'dip.vsYesterday': 'vs yesterday',
  'dip.recentRange': 'Recent index range',
  'dip.methodologyProse': "The BYDFi Dip Index is BYDFi News's own composite signal that blends multiple data sources into a single 0–100 reading across four dimensions: on-chain valuation (MVRV Z-Score, NUPL), technicals (BTC drawdown from its all-time high, 200-day MA deviation, 14-day RSI oversold), market sentiment (Fear & Greed, perpetual funding rate), and our exclusive news-fear gauge (the share of crash-type news over the past 24 hours). Each input is normalized and weighted; a higher score means the market leans more fearful/oversold, which historically has corresponded to better accumulation zones. Sources: bitcoin-data.com (on-chain), Alternative.me, CoinGecko, Binance and the BYDFi News feed.",
  'dip.disclaimer': '⚠️ This index is for market reference and education only and is not investment advice. Crypto is highly volatile — do your own research and assess the risk.',

  'top.triggered': '{a} / {b} signals triggered',
  'top.chartHeader': 'Index trend (last {n} days)',
  'top.streak': '{n} days running in the top zone (≥60)',
  'top.signalsHeader': '{n} core top signals',
  'top.signalsSub': 'Each checked against its top threshold (triggered / not); a higher score means closer to a cycle top. {n} triggered.',
  'top.backtestTitle': 'How much less would you have lost?',
  'top.backtestSub': 'Backtest historical BTC: if you had exited on the top signal then, how much less you would have lost today.',
  'top.gainersHeader': '🚀 Overheated leaderboard (biggest 24h gains)',
  'top.gainersSub': 'BYDFi-tradeable coins · big runs carry pullback risk, tap to view',
  'top.newsHeader': '📰 Overheat intel',
  'top.newsSub': 'New highs, FOMO and overheating news',
  'top.methodology': 'Methodology',
  'top.title': 'BYDFi Top Index',
  'top.updated': 'Updated: {time} (recalculated every 2h)',
  'top.vsYesterday': 'vs yesterday',
  'top.recentRange': 'Recent index range',
  'top.methodologyProse': "The BYDFi Top Index is BYDFi News's own composite signal that bundles top-specific indicators into a single 0–100 reading and lists, item by item, whether each top threshold has triggered. It covers: on-chain valuation (MVRV Z-Score, NUPL, Puell Multiple), cycle models (Pi Cycle Top, Mayer Multiple), market sentiment (Fear & Greed), derivatives (perpetual funding rate), market structure (BTC dominance reversal), and our exclusive news-euphoria gauge (the share of new-high/FOMO news over the past 24 hours). It is not the inverse of the Dip Index but an independent set of top signals; a higher score and more triggers mean closer to a cycle top and more worth considering staged profit-taking. Sources: bitcoin-data.com (on-chain), Alternative.me, CoinGecko, Binance and the BYDFi News feed.",
  'top.disclaimer': '⚠️ This index is for market reference and education only and is not investment advice. Crypto is highly volatile — do your own research and assess the risk.',
  'top.triggeredBadge': 'Triggered',
  'top.notTriggeredBadge': 'Not yet',

  'cross.view': 'View →',

  'bt.dateSell': 'Exit date',
  'bt.dateBuy': 'Buy-the-dip date',
  'bt.amount': 'Amount (USD)',
  'bt.running': 'Running…',
  'bt.run': 'Run →',
  'bt.errNoPrice': 'No price for that date right now — try again later or pick another date',
  'bt.errBadInput': 'Lookup failed — check the date and amount',
  'bt.errGeneric': 'Lookup failed — please try again later',
};

const DICTS: Record<Locale, Dict> = { zh, en };

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
  let s = dict[key] ?? DICTS[DEFAULT_LOCALE][key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
