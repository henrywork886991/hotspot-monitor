'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NewsItem } from '@/types';
import { relTime } from '@/lib/format';
import { IMPORTANCE_CONFIG, CATEGORY_BG, sourceColor } from '@/lib/news-style';
import { articlePath, coinPath } from '@/lib/site';
import css from 'styled-jsx/css';

const styles = css`
  .news-card {
    background: var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .news-card:hover {
    border-color: var(--skin-primary-color);
    box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.5);
    transform: translateY(-2px);
  }
  :global(.card-link) {
    display: flex;
    flex-direction: column;
    flex: 1;
    cursor: pointer;
  }
  .card-img-wrap {
    position: relative;
    width: 100%;
    height: 168px;
    flex-shrink: 0;
    overflow: hidden;
  }
  .card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: var(--spec-background-color-4);
  }
  .card-img-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: flex-start;
    padding: 12px 14px;
  }
  .fallback-source {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.5;
  }
  .importance-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
  }
  .card-body {
    padding: 14px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }
  .card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .source-tag {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .card-date {
    font-size: 11px;
    color: var(--spec-font-color-3);
    white-space: nowrap;
  }
  .card-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.5;
    color: var(--spec-font-color-1);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    margin: 0;
  }
  .card-summary {
    font-size: 12px;
    line-height: 1.6;
    color: var(--spec-font-color-2);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    margin: 0;
  }
  .card-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: auto;
    padding-top: 6px;
  }
  .kw-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 3px;
    background: var(--spec-background-color-4);
    color: var(--spec-font-color-3);
    border: 1px solid var(--spec-border-level-3);
  }
  /* Coin badges live OUTSIDE the article link so they can be real <a> to /coin. */
  .coin-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px 14px;
  }
  :global(.coin-badge) {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 3px;
    background: var(--skin-brand-bg-color-opacity);
    color: var(--skin-primary-color);
    border: 1px solid rgba(var(--skin-primary-color-rgb), 0.35);
    transition: background 0.15s, border-color 0.15s;
  }
  :global(.coin-badge:hover) {
    background: var(--skin-primary-color);
    color: var(--spec-brand-bg-font-color);
  }
`;

// First real paragraph (the Answer-Box lead) of a rewritten article — used as the
// card snippet so the feed shows the unified-language text, not the source one.
function articleLead(md: string | null): string {
  if (!md) return '';
  const lead = md
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('-')) || '';
  return lead.replace(/\*\*/g, '');
}

export default function NewsCard({ item }: { item: NewsItem }) {
  const importance = item.importance ? IMPORTANCE_CONFIG[item.importance] : null;
  const displayTitle = item.article_title || item.title;
  const displayText = articleLead(item.article_md) || item.summary_zh || item.summary || item.content?.slice(0, 160) || '';
  const bg = CATEGORY_BG[item.category] ?? CATEGORY_BG.all;
  const sColor = sourceColor(item.source);
  const [imgOk, setImgOk] = useState(Boolean(item.image_url));
  const coins = (item.symbols || '')
    .split(',')
    .map((p) => p.split('_')[0].trim())
    .filter(Boolean)
    .slice(0, 3);
  // Coin badges (bright/tradeable) win — drop any keyword tag that duplicates one.
  const coinSet = new Set(coins.map((c) => c.toUpperCase()));
  const kws = (item.keywords || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k && !coinSet.has(k.toUpperCase()))
    .slice(0, coins.length ? 2 : 3);

  return (
    <div className="news-card">
      <Link href={articlePath(item)} className="card-link">
        <div className="card-img-wrap">
          {imgOk && item.image_url ? (
            <img
              className="card-img"
              src={item.image_url}
              alt={displayTitle}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgOk(false)}
            />
          ) : (
            <div className="card-img-fallback" style={{ background: bg }}>
              <span className="fallback-source" style={{ color: sColor }}>
                {item.source}
              </span>
            </div>
          )}
          {importance && (
            <span
              className="importance-badge"
              style={{ color: importance.color, background: importance.bg }}
            >
              {importance.label}
            </span>
          )}
        </div>

        <div className="card-body">
          <div className="card-meta">
            <span className="source-tag" style={{ color: sColor }}>{item.source}</span>
            <span className="card-date">{relTime(item.published_at || item.fetched_at)}</span>
          </div>
          <h3 className="card-title">{displayTitle}</h3>
          {displayText && <p className="card-summary">{displayText}</p>}
          {kws.length > 0 && (
            <div className="card-footer">
              {kws.map((kw) => <span key={kw} className="kw-tag">{kw}</span>)}
            </div>
          )}
        </div>
      </Link>

      {coins.length > 0 && (
        <div className="coin-row">
          {coins.map((c) => (
            <Link key={c} href={coinPath(c)} className="coin-badge" title={`${c} 相關新聞與交易`}>{c}</Link>
          ))}
        </div>
      )}

      <style jsx>{styles}</style>
    </div>
  );
}
