import CategoryTabs from '@/components/CategoryTabs';
import NewsFeed from '@/components/NewsFeed';
import MarketsFeed from '@/components/MarketsFeed';
import CoinChips from '@/components/CoinChips';
import { queryNews, getFlash, getHotCoins } from '@/lib/db';
import { getFearGreed, getDipIndex, getTopIndex, getCoinPrices } from '@/lib/market-extras';
import { categoryFullLabel, categoryLabel } from '@/lib/site';
import { LOCALES, isLocale } from '@/lib/i18n/config';
import { t } from '@/lib/i18n/messages';
import { altLanguages } from '@/lib/i18n/seo';
import { Category } from '@/types';

/* Categories where a coin-level sub-navigation makes sense (token-centric news). */
const COIN_NAV_CATEGORIES = new Set(['crypto', 'cn_crypto', 'defi']);

// ISR: news flow updates every refresh; 5-min cache balances freshness vs speed.
export const revalidate = 300;

// The category set is fixed and known — prerender them all into the ISR cache.
export function generateStaticParams() {
  const cats = ['altcoin', 'crypto', 'cn_crypto', 'defi', 'web3', 'regulation', 'macro', 'stocks', 'tech', 'asia'];
  return LOCALES.flatMap((locale) => cats.map((category) => ({ locale, category })));
}

interface Props {
  params: Promise<{ locale: string; category: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale: loc, category } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  const label = categoryFullLabel(category, locale);
  return {
    title: t(locale, 'meta.catTitle', { label }),
    description: t(locale, 'meta.catDesc', { label }),
    alternates: altLanguages(`/news/${category}`, locale),
  };
}

export default async function CategoryPage({ params }: Props) {
  const { locale: loc, category } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  if (category === 'markets') {
    return (
      <>
        <CategoryTabs />
        <MarketsFeed fearGreed={getFearGreed()} />
      </>
    );
  }
  const label = categoryFullLabel(category, locale);
  const isAltcoin = category === 'altcoin';
  const { items, total } = queryNews({ category: category as Category, limit: 24, readyOnly: true });
  const flash = getFlash(30);
  const hotCoins = getHotCoins(14, { altcoinOnly: isAltcoin });
  const dipIndex = getDipIndex();
  const topIndex = getTopIndex();
  const showCoinNav = isAltcoin || COIN_NAV_CATEGORIES.has(category);
  const coinPrices = showCoinNav ? getCoinPrices(hotCoins.map((c) => c.base)) : {};
  const chipLabel = isAltcoin ? t(locale, 'nav.altcoin') : categoryLabel(category, locale);
  return (
    <>
      <h1 className="sr-only">{t(locale, 'feed.catH1', { label })}</h1>
      <CategoryTabs />
      {showCoinNav && <CoinChips coins={hotCoins} prices={coinPrices} label={chipLabel} />}
      <NewsFeed category={category as Category} initialItems={items} initialTotal={total} flashItems={flash} hotCoins={hotCoins} dipIndex={dipIndex} topIndex={topIndex} />
    </>
  );
}
