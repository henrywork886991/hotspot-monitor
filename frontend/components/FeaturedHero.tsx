'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NewsItem } from '@/types';
import { relTime } from '@/lib/format';
import { IMPORTANCE_CONFIG, CATEGORY_BG, sourceColor } from '@/lib/news-style';
import { articlePath } from '@/lib/site';
import css from 'styled-jsx/css';

const styles = css`
  .hero {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    background: var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    min-height: 280px;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .hero:hover {
    border-color: var(--skin-primary-color);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
    transform: translateY(-2px);
  }
  .hero-img-wrap { position: relative; overflow: hidden; }
  .hero-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hero-fallback {
    width: 100%; height: 100%; min-height: 220px;
    display: flex; align-items: flex-end; padding: 16px 18px;
  }
  .hero-fallback span { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.5; }
  .feat-badge {
    position: absolute; top: 14px; left: 14px;
    font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
    color: var(--spec-brand-bg-font-color); background: var(--skin-primary-color);
    padding: 4px 10px; border-radius: 5px;
  }
  .hero-body {
    padding: 24px 26px; display: flex; flex-direction: column; gap: 14px; justify-content: center;
  }
  .hero-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; }
  .imp { font-weight: 700; padding: 2px 8px; border-radius: 4px; }
  .src { font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .time { color: var(--spec-font-color-3); }
  .hero-title {
    font-size: 24px; font-weight: 700; line-height: 1.35; color: var(--spec-font-color-1);
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
  }
  .hero-summary {
    font-size: 14px; line-height: 1.65; color: var(--spec-font-color-2);
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
  }
  .hero-kw { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .kw {
    font-size: 11px; padding: 3px 9px; border-radius: 4px;
    background: var(--spec-background-color-4); color: var(--spec-font-color-3);
    border: 1px solid var(--spec-border-level-3);
  }
  @media (max-width: 900px) {
    .hero { grid-template-columns: 1fr; }
    .hero-img-wrap { min-height: 180px; max-height: 200px; }
    .hero-title { font-size: 20px; }
  }
`;

export default function FeaturedHero({ item }: { item: NewsItem }) {
  const [imgOk, setImgOk] = useState(Boolean(item.image_url));
  const imp = item.importance ? IMPORTANCE_CONFIG[item.importance] : null;
  const sColor = sourceColor(item.source);
  const bg = CATEGORY_BG[item.category] ?? CATEGORY_BG.all;
  const text = item.summary ?? item.content?.slice(0, 220) ?? '';

  return (
    <Link href={articlePath(item)} className="hero">
      <div className="hero-img-wrap">
        {imgOk && item.image_url ? (
          <img className="hero-img" src={item.image_url} alt={item.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
        ) : (
          <div className="hero-fallback" style={{ background: bg }}>
            <span style={{ color: sColor }}>{item.source}</span>
          </div>
        )}
        <span className="feat-badge">焦點</span>
      </div>

      <div className="hero-body">
        <div className="hero-meta">
          {imp && <span className="imp" style={{ color: imp.color, background: imp.bg }}>{imp.label}</span>}
          <span className="src" style={{ color: sColor }}>{item.source}</span>
          <span className="time">{relTime(item.published_at || item.fetched_at)}</span>
        </div>
        <h2 className="hero-title">{item.title}</h2>
        {text && <p className="hero-summary">{text}</p>}
        {item.keywords && (
          <div className="hero-kw">
            {item.keywords.split(',').slice(0, 4).map((k) => <span key={k} className="kw">{k.trim()}</span>)}
          </div>
        )}
      </div>

      <style jsx>{styles}</style>
    </Link>
  );
}
