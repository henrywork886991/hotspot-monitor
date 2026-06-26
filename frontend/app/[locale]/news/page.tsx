import CategoryTabs from '@/components/CategoryTabs';
import NewsFeed from '@/components/NewsFeed';
import { queryNews, getFlash, getHotCoins } from '@/lib/db';
import { getDipIndex, getTopIndex } from '@/lib/market-extras';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '加密貨幣 & 科技熱點 — Hotspot Monitor',
  description: '即時監控 88 個數據源的加密貨幣、DeFi、美股、科技熱點新聞',
  // Consolidate ?q= search / paginated variants onto the clean /news URL.
  alternates: { canonical: '/news' },
};

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const keyword = q?.trim() || undefined;
  // Server-render the first page so the feed + sidebar are in the initial HTML
  // (indexable by Google / citable by AI engines — GEO+SEO 守則).
  const { items, total } = queryNews({ category: 'all', keyword, limit: 24, readyOnly: true });
  const flash = getFlash(30);
  const hotCoins = getHotCoins(14);
  const dipIndex = getDipIndex();
  const topIndex = getTopIndex();
  return (
    <>
      <h1 className="sr-only">
        {keyword ? `「${keyword}」搜尋結果` : '加密貨幣、DeFi、美股與科技熱點新聞 — 即時市場動態'}
      </h1>
      <CategoryTabs />
      <NewsFeed key={keyword || 'all'} category="all" keyword={keyword} initialItems={items} initialTotal={total} flashItems={flash} hotCoins={hotCoins} dipIndex={dipIndex} topIndex={topIndex} />
    </>
  );
}
