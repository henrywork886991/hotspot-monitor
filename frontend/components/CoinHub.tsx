'use client';

import Link from 'next/link';
import { NewsItem } from '@/types';
import { CoinPrice } from '@/lib/market-extras';
import { fmtUsd, fmtPct } from '@/lib/format';
import NewsCard from './NewsCard';
import css from 'styled-jsx/css';

const styles = css`
  .wrap { max-width: var(--const-max-page-width); margin: 0 auto; padding: 28px 32px 56px; }
  .crumbs { font-size: 13px; color: var(--spec-font-color-3); margin-bottom: 18px; }
  :global(.crumbs a:hover) { color: var(--skin-primary-color); }
  .hero {
    display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;
    padding: 24px 26px; margin-bottom: 24px; border-radius: 14px;
    background:
      radial-gradient(120% 140% at 0% 0%, rgba(255,211,15,0.14) 0%, rgba(255,211,15,0) 55%),
      var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
  }
  .id { display: flex; align-items: center; gap: 16px; }
  .badge {
    width: 56px; height: 56px; border-radius: 14px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 900; letter-spacing: -0.5px;
    background: var(--skin-primary-color); color: var(--spec-brand-bg-font-color);
  }
  h1.name { font-size: 26px; font-weight: 800; color: var(--spec-font-color-1); line-height: 1.2; }
  .ticker { font-size: 14px; color: var(--spec-font-color-3); margin-top: 4px; }
  .price-row { display: flex; align-items: baseline; gap: 10px; margin-top: 8px; }
  .price-now { font-size: 20px; font-weight: 800; color: var(--spec-font-color-1); }
  .price-chg { font-size: 14px; font-weight: 700; }
  .price-chg.up { color: var(--color-green); }
  .price-chg.down { color: var(--color-red); }
  .intro {
    font-size: 15px; line-height: 1.75; color: var(--spec-font-color-2);
    margin-bottom: 24px; max-width: 820px;
  }
  :global(.trade-cta) {
    display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;
    padding: 12px 22px; border-radius: 10px; font-size: 15px; font-weight: 800;
    background: var(--skin-primary-color); color: var(--spec-brand-bg-font-color);
    transition: background .15s;
  }
  :global(.trade-cta:hover) { background: var(--skin-primary-bg-hover-color); }
  .news-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  @media (max-width: 1199px) { .news-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 1023px) { .news-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 767px) { .wrap { padding: 16px; } .news-grid { grid-template-columns: 1fr; } }

  .faq { margin-top: 48px; max-width: 820px; }
  .faq-h { font-size: 20px; font-weight: 800; color: var(--spec-font-color-1); margin-bottom: 16px; }
  .faq-item {
    border: 1px solid var(--spec-border-level-2); border-radius: 10px;
    background: var(--spec-background-color-3); margin-bottom: 10px; overflow: hidden;
  }
  .faq-item summary {
    list-style: none; cursor: pointer; padding: 16px 18px;
    font-size: 15px; font-weight: 700; color: var(--spec-font-color-1);
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary::after { content: '+'; font-size: 20px; color: var(--spec-font-color-3); transition: transform .15s; }
  .faq-item[open] summary::after { transform: rotate(45deg); }
  .faq-a { padding: 0 18px 18px; font-size: 14px; line-height: 1.75; color: var(--spec-font-color-2); }
`;

interface Props {
  base: string; name: string; count: number; tradeUrl: string; tradePair: string;
  items: NewsItem[]; intro?: string; price?: CoinPrice | null; faqs?: { q: string; a: string }[];
}

export default function CoinHub({ base, name, count, tradeUrl, tradePair, items, intro, price, faqs = [] }: Props) {
  const quote = tradePair.split('_')[1] || 'USDT';
  const up = (price?.pct24h ?? 0) >= 0;
  return (
    <div className="wrap">
      <nav className="crumbs"><Link href="/news">首頁</Link> / {name} ({base})</nav>

      <section className="hero">
        <div className="id">
          <span className="badge">{base.slice(0, 4)}</span>
          <div>
            <h1 className="name">{name} 最新新聞與分析</h1>
            <div className="ticker">{base} · 共 {count} 篇相關報導（最近72小時）</div>
            {price && (
              <div className="price-row">
                <span className="price-now">{fmtUsd(price.price)}</span>
                {price.pct24h !== null && (
                  <span className={`price-chg ${up ? 'up' : 'down'}`}>{fmtPct(price.pct24h)} (24h)</span>
                )}
              </div>
            )}
          </div>
        </div>
        <a className="trade-cta" href={tradeUrl} target="_blank" rel="noopener noreferrer">
          在 BYDFi 交易 {base}/{quote} →
        </a>
      </section>

      {intro && <p className="intro">{intro}</p>}

      <div className="news-grid">
        {items.map((it) => <NewsCard key={it.id} item={it} />)}
      </div>

      {faqs.length > 0 && (
        <section className="faq">
          <h2 className="faq-h">關於 {name}（{base}）的常見問題</h2>
          {faqs.map((f, i) => (
            <details key={i} className="faq-item" open={i === 0}>
              <summary>{f.q}</summary>
              <div className="faq-a">{f.a}</div>
            </details>
          ))}
        </section>
      )}

      <style jsx>{styles}</style>
    </div>
  );
}
