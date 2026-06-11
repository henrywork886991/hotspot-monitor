import CategoryTabs from '@/components/CategoryTabs';
import NewsFeed from '@/components/NewsFeed';
import MarketsFeed from '@/components/MarketsFeed';
import CoinChips from '@/components/CoinChips';
import { queryNews, getHotCoins } from '@/lib/db';
import { getFearGreed, getDipIndex, getTopIndex, getCoinPrices } from '@/lib/market-extras';
import { Category } from '@/types';

/* Categories where a coin-level sub-navigation makes sense (token-centric news). */
const COIN_NAV_CATEGORIES = new Set(['crypto', 'cn_crypto', 'defi']);
const COIN_NAV_LABELS: Record<string, string> = { crypto: 'Crypto', cn_crypto: '中文幣圈', defi: 'DeFi' };

// ISR: news flow updates every refresh; 5-min cache balances freshness vs speed.
export const revalidate = 300;

// The category set is fixed and known — prerender them all into the ISR cache.
export function generateStaticParams() {
  return ['crypto', 'cn_crypto', 'defi', 'web3', 'regulation', 'macro', 'stocks', 'tech', 'asia']
    .map((category) => ({ category }));
}

const CATEGORY_LABELS: Record<string, string> = {
  markets:    '行情數據',
  crypto:     'Crypto 加密貨幣',
  defi:       'DeFi 去中心化金融',
  web3:       'Web3 基礎設施',
  cn_crypto:  '中文幣圈',
  asia:       '亞洲市場',
  stocks:     '美股',
  macro:      '宏觀經濟',
  regulation: '監管合規',
  tech:       '科技 & AI',
};

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { category } = await params;
  const label = CATEGORY_LABELS[category] ?? category;
  return {
    title: `${label} 熱點 — Hotspot Monitor`,
    description: `最新 ${label} 相關新聞與熱點分析`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  if (category === 'markets') {
    return (<><CategoryTabs /><MarketsFeed fearGreed={getFearGreed()} /></>);
  }
  const label = CATEGORY_LABELS[category] ?? category;
  const { items, total } = queryNews({ category: category as Category, limit: 24 });
  const hotCoins = getHotCoins(14);
  const dipIndex = getDipIndex();
  const topIndex = getTopIndex();
  const showCoinNav = COIN_NAV_CATEGORIES.has(category);
  const coinPrices = showCoinNav ? getCoinPrices(hotCoins.map((c) => c.base)) : {};
  return (
    <>
      <h1 className="sr-only">{label} 熱點新聞 — 最新市場動態與分析</h1>
      <CategoryTabs />
      {showCoinNav && <CoinChips coins={hotCoins} prices={coinPrices} label={COIN_NAV_LABELS[category] ?? label} />}
      <NewsFeed category={category as Category} initialItems={items} initialTotal={total} hotCoins={hotCoins} dipIndex={dipIndex} topIndex={topIndex} />
    </>
  );
}
