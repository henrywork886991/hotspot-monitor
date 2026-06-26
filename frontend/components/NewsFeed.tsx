'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { NewsItem } from '@/types';
import css from 'styled-jsx/css';
import NewsCard from './NewsCard';
import FeaturedHero from './FeaturedHero';
import NewsSidebar, { HotCoin } from './NewsSidebar';
import { DipIndex, TopIndex } from '@/lib/market-extras';
import TypeFilter from './TypeFilter';
import { useLocale } from './LocaleProvider';
import { t } from '@/lib/i18n/messages';

const styles = css`
  .feed-wrap {
    max-width: var(--const-max-page-width);
    margin: 0 auto;
    padding: 24px 32px;
  }
  .feed-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
  }
  .count-text {
    font-size: 13px;
    color: var(--spec-font-color-3);
  }
  .feed-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 24px;
    align-items: start;
  }
  .main-col { min-width: 0; display: flex; flex-direction: column; gap: 18px; }
  .hero-slot { margin-bottom: 2px; }
  .news-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .skeleton-card {
    height: 320px;
    border-radius: 8px;
    background: linear-gradient(
      90deg,
      var(--spec-background-color-3) 25%,
      var(--spec-background-color-4) 50%,
      var(--spec-background-color-3) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--spec-font-color-2);
  }
  .empty-icon { font-size: 48px; margin-bottom: 16px; }
  .empty-text { font-size: 15px; margin-bottom: 12px; color: var(--spec-font-color-2); }
  .empty-hint {
    font-size: 12px;
    color: var(--spec-font-color-3);
    background: var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-3);
    padding: 8px 16px;
    border-radius: 6px;
    display: inline-block;
  }
  .load-more-wrap {
    display: flex;
    justify-content: center;
    margin-top: 32px;
  }
  .load-more-btn {
    padding: 10px 40px;
    border: 1px solid var(--spec-border-level-3);
    border-radius: 4px;
    background: transparent;
    color: var(--spec-font-color-2);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .load-more-btn:hover {
    border-color: var(--skin-primary-color);
    color: var(--skin-primary-color);
  }
  @media (max-width: 1100px) {
    .feed-layout { grid-template-columns: 1fr; }
  }
  @media (max-width: 1023px) {
    .news-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 767px) {
    .feed-wrap { padding: 16px; }
    .news-grid { grid-template-columns: 1fr; }
  }
`;

const LIMIT = 24;

interface NewsFeedProps {
  category: string;
  keyword?: string;
  initialItems?: NewsItem[];
  initialTotal?: number;
  flashItems?: NewsItem[];
  hotCoins?: HotCoin[];
  dipIndex?: DipIndex | null;
  topIndex?: TopIndex | null;
}

export default function NewsFeed({ category, keyword, initialItems = [], initialTotal = 0, flashItems, hotCoins = [], dipIndex, topIndex }: NewsFeedProps) {
  const locale = useLocale();
  const [items, setItems] = useState<NewsItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(2);             // page 1 was server-rendered
  const [importance, setImportance] = useState('all');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length < initialTotal);

  const fetchNews = useCallback(async (reset = false) => {
    setLoading(true);
    const p = reset ? 1 : page;
    const params = new URLSearchParams({ category, importance, page: String(p), limit: String(LIMIT), ready: '1' });
    if (keyword) params.set('keyword', keyword);
    try {
      const res = await fetch(`/api/news?${params}`);
      const data = await res.json();
      if (reset) { setItems(data.items); setPage(2); }
      else { setItems((prev) => [...prev, ...data.items]); setPage((prev) => prev + 1); }
      setTotal(data.total);
      setHasMore(p * LIMIT < data.total);
    } finally {
      setLoading(false);
    }
  }, [category, importance, keyword, page]);

  // First paint comes from SSR props — only re-fetch when the importance filter
  // changes (a category switch is a full server-rendered navigation).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setItems([]); setPage(1); setHasMore(true);
    fetchNews(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importance]);

  // Featured = newest high-impact story that has a cover image; fall back to the
  // first item with any image, then to the very first item.
  const heroIdx = (() => {
    const big = items.findIndex((i) => i.image_url && (i.importance === 'urgent' || i.importance === 'high'));
    if (big >= 0) return big;
    const img = items.findIndex((i) => i.image_url);
    return img >= 0 ? img : 0;
  })();
  // No featured hero in search results — a flat grid reads better.
  const hero = keyword ? null : (items.length > 0 ? items[heroIdx] : null);
  const rest = keyword ? items : items.filter((_, i) => i !== heroIdx);

  return (
    <div className="feed-wrap">
      <div className="feed-header">
        <span className="count-text">
          {keyword
            ? t(locale, 'feed.searchResults', { kw: keyword, n: total })
            : (total > 0 ? t(locale, 'feed.count', { n: total }) : ' ')}
        </span>
        <TypeFilter current={importance} onChange={setImportance} />
      </div>

      {items.length === 0 && !loading ? (
        keyword ? (
          <div className="empty-state">
            <p className="empty-icon">🔍</p>
            <p className="empty-text">{t(locale, 'feed.emptySearch', { kw: keyword ?? '' })}</p>
          </div>
        ) : (
        <div className="empty-state">
          <p className="empty-icon">📭</p>
          <p className="empty-text">{t(locale, 'feed.emptyData')}</p>
          <code className="empty-hint">python scripts/collect_trend.py | python scripts/save_to_db.py</code>
        </div>
        )
      ) : (
        <div className="feed-layout">
          <div className="main-col">
            {hero && (
              <div className="hero-slot"><FeaturedHero item={hero} /></div>
            )}
            <div className="news-grid">
              {rest.map((item) => <NewsCard key={item.id} item={item} />)}
              {loading && [...Array(3)].map((_, i) => <div key={i} className="skeleton-card" />)}
            </div>
            {hasMore && !loading && (
              <div className="load-more-wrap">
                <button className="load-more-btn" onClick={() => fetchNews(false)}>{t(locale, 'feed.loadMore')}</button>
              </div>
            )}
          </div>

          <NewsSidebar items={flashItems ?? initialItems} hotCoins={hotCoins} dipIndex={dipIndex} topIndex={topIndex} />
        </div>
      )}

      <style jsx>{styles}</style>
    </div>
  );
}
