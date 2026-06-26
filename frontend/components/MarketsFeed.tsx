'use client';

import { useState, useEffect } from 'react';
import { NewsItem } from '@/types';
import { FearGreed as FG } from '@/lib/market-extras';
import FearGreed from './FearGreed';
import { useLocale } from './LocaleProvider';
import { t } from '@/lib/i18n/messages';
import css from 'styled-jsx/css';

/* Markets view — price data for BYDFi-tradeable coins. Every row links to the
   BYDFi spot page (never to CoinGecko/competitors). Kept out of the news flow. */

interface Group {
  key: string;
  title: string;
  sub: string;
  items: NewsItem[];
}

const SECTIONS: { source: string; titleKey: string; subKey: string }[] = [
  { source: 'cg_losers',   titleKey: 'markets.dip',     subKey: 'markets.dipSub' },
  { source: 'cg_trending', titleKey: 'markets.hot',     subKey: 'markets.hotSub' },
  { source: 'cg_gainers',  titleKey: 'markets.gainers', subKey: 'markets.gainersSub' },
];

/* Pull "24h: -2.34%" out of the CoinGecko content string for coloring. */
function parse24h(content: string | null): number | null {
  if (!content) return null;
  const m = content.match(/24h:\s*(-?\d+(?:\.\d+)?)%/);
  return m ? parseFloat(m[1]) : null;
}
function parsePrice(content: string | null): string | null {
  if (!content) return null;
  const m = content.match(/Price:\s*([^|]+)/);
  return m ? m[1].trim() : null;
}

const styles = css`
  .markets-wrap { max-width: var(--const-max-page-width); margin: 0 auto; padding: 24px 32px; }
  .markets-head { margin-bottom: 18px; }
  .markets-title { font-size: 18px; font-weight: 700; color: var(--spec-font-color-1); }
  .markets-note {
    font-size: 12px; color: var(--spec-font-color-3); margin-top: 4px;
  }
  .fg-banner {
    background: var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
    border-radius: 12px; margin-bottom: 16px; max-width: 420px;
  }
  .sections { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .section {
    background: var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
    border-radius: 10px; overflow: hidden;
  }
  .section-head {
    display: flex; align-items: baseline; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid var(--spec-border-level-2);
  }
  .section-head .h { font-size: 14px; font-weight: 700; color: var(--spec-font-color-1); }
  .section-head .s { font-size: 11px; color: var(--spec-font-color-3); }
  .row {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 16px; border-bottom: 1px solid var(--spec-border-level-1);
    cursor: pointer; transition: background 0.12s;
  }
  .row:last-child { border-bottom: none; }
  .row:hover { background: var(--spec-background-color-4); }
  .rank { font-size: 11px; color: var(--spec-font-color-3); width: 18px; flex-shrink: 0; }
  .name {
    flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--spec-font-color-1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .price { font-size: 12px; color: var(--spec-font-color-2); white-space: nowrap; }
  .chg {
    font-size: 12px; font-weight: 700; white-space: nowrap;
    min-width: 56px; text-align: right;
  }
  .up { color: var(--color-green); }
  .down { color: var(--color-red); }
  .meta { flex: 1; min-width: 0; font-size: 11px; color: var(--spec-font-color-3);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .empty { padding: 40px 16px; text-align: center; color: var(--spec-font-color-3); font-size: 13px; }
  @media (max-width: 1023px) { .sections { grid-template-columns: 1fr; } }
  @media (max-width: 767px) { .markets-wrap { padding: 16px; } }
`;

export default function MarketsFeed({ fearGreed }: { fearGreed?: FG | null }) {
  const locale = useLocale();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news?category=markets&limit=50&hours=72')
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  const groups: Group[] = SECTIONS.map((s) => ({
    key: s.source,
    title: t(locale, s.titleKey),
    sub: t(locale, s.subKey),
    items: items.filter((i) => i.source === s.source),
  }));

  return (
    <div className="markets-wrap">
      <div className="markets-head">
        <div className="markets-title">{t(locale, 'markets.title')}</div>
        <div className="markets-note">{t(locale, 'markets.subtitle')}</div>
      </div>

      {fearGreed && (
        <div className="fg-banner">
          <FearGreed data={fearGreed} />
        </div>
      )}

      <div className="sections">
        {groups.map((g) => (
          <div key={g.key} className="section">
            <div className="section-head">
              <span className="h">{g.title}</span>
              <span className="s">{g.sub}</span>
            </div>
            {g.items.length === 0 ? (
              <div className="empty">{loading ? t(locale, 'markets.loading') : t(locale, 'markets.empty')}</div>
            ) : (
              g.items.map((item, idx) => {
                const chg = parse24h(item.content);
                const price = parsePrice(item.content);
                return (
                  <a key={item.id} className="row" href={item.url} target="_blank" rel="noopener noreferrer">
                    <span className="rank">{idx + 1}</span>
                    <span className="name">{item.title}</span>
                    {price && <span className="price">{price}</span>}
                    {chg !== null && (
                      <span className={`chg ${chg >= 0 ? 'up' : 'down'}`}>
                        {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                      </span>
                    )}
                  </a>
                );
              })
            )}
          </div>
        ))}
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}
