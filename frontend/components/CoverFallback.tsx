'use client';

import { NewsItem } from '@/types';
import { CATEGORY_BG, sourceColor } from '@/lib/news-style';
import css from 'styled-jsx/css';

/**
 * Branded cover shown when an article has no usable image (or its image 404s).
 * Guarantees no card is ever blank: category gradient + a source-colour glow,
 * a big translucent monogram (the article's lead coin ticker, else the source
 * initials), an accent stripe and the source wordmark. Deterministic per item,
 * zero cost, never fails — this is the "every article has an image" guarantee.
 */
const styles = css`
  .cover {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .accent { position: absolute; top: 0; left: 0; right: 0; height: 3px; }
  .glow {
    position: absolute;
    right: -12%;
    top: -25%;
    width: 70%;
    height: 130%;
    border-radius: 50%;
    filter: blur(44px);
    opacity: 0.16;
    pointer-events: none;
  }
  .mono {
    position: absolute;
    right: -4px;
    top: 50%;
    transform: translateY(-50%);
    font-weight: 800;
    line-height: 0.85;
    letter-spacing: -3px;
    opacity: 0.18;
    user-select: none;
    white-space: nowrap;
  }
  .src {
    position: relative;
    z-index: 1;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  /* size variants */
  .card .mono { font-size: 104px; }
  .card .src  { font-size: 12px; padding: 12px 14px; }
  .hero .mono { font-size: 168px; letter-spacing: -6px; }
  .hero .src  { font-size: 14px; padding: 18px 20px; }
  .article .mono { font-size: 200px; letter-spacing: -8px; }
  .article .src  { font-size: 16px; padding: 18px 20px; }
`;

function monogram(item: NewsItem): string {
  const coin = (item.symbols || '').split(',')[0]?.split('_')[0]?.trim();
  if (coin) return coin.toUpperCase().slice(0, 4);
  const letters = item.source.replace(/[^a-zA-Z]/g, '');
  return (letters.slice(0, 2) || '#').toUpperCase();
}

export default function CoverFallback({
  item,
  variant = 'card',
}: {
  item: NewsItem;
  variant?: 'card' | 'hero' | 'article';
}) {
  const bg = CATEGORY_BG[item.category] ?? CATEGORY_BG.all;
  const color = sourceColor(item.source);

  return (
    <div className={`cover ${variant}`} style={{ background: bg }}>
      <span className="accent" style={{ background: color }} />
      <span className="glow" style={{ background: color }} />
      <span className="mono" style={{ color }}>{monogram(item)}</span>
      <span className="src" style={{ color }}>{item.source}</span>
      <style jsx>{styles}</style>
    </div>
  );
}
