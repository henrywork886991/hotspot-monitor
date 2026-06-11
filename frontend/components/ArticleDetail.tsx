'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NewsItem } from '@/types';
import { parseUtc, fmtPct } from '@/lib/format';
import { CoinPrice } from '@/lib/market-extras';
import { IMPORTANCE_CONFIG, CATEGORY_BG, sourceColor } from '@/lib/news-style';
import { coinPath, bydfiSpotUrl } from '@/lib/site';
import NewsCard from './NewsCard';
import MarkdownArticle from './MarkdownArticle';
import css from 'styled-jsx/css';

const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto 加密貨幣', defi: 'DeFi', web3: 'Web3', cn_crypto: '中文幣圈',
  asia: '亞洲市場', stocks: '美股', macro: '宏觀經濟', regulation: '監管合規', tech: '科技 & AI',
};
const SIGNUP_URL = 'https://www.bydfi.com/en/register';

function fmtDate(s: string | null): string {
  if (!s) return '';
  const t = parseUtc(s);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = css`
  .wrap { max-width: 820px; margin: 0 auto; padding: 28px 24px 64px; }
  .crumbs { font-size: 13px; color: var(--spec-font-color-3); margin-bottom: 18px; display: flex; gap: 8px; flex-wrap: wrap; }
  :global(.crumbs a) { color: var(--spec-font-color-3); }
  :global(.crumbs a:hover) { color: var(--skin-primary-color); }
  .meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; font-size: 13px; }
  .imp { font-weight: 700; padding: 3px 9px; border-radius: 5px; }
  .src { font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .time { color: var(--spec-font-color-3); }
  h1.title { font-size: 32px; font-weight: 800; line-height: 1.3; color: var(--spec-font-color-1); margin-bottom: 20px; }
  .hero-img { width: 100%; max-height: 440px; object-fit: cover; border-radius: 12px; display: block; margin-bottom: 24px; background: var(--spec-background-color-3); }
  .hero-fallback { width: 100%; height: 240px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: flex-end; padding: 18px; }
  .hero-fallback span { font-size: 16px; font-weight: 700; text-transform: uppercase; opacity: 0.5; }
  .body { font-size: 16px; line-height: 1.85; color: var(--spec-font-color-1); }
  .body p { margin-bottom: 18px; }
  .body :global(h2) { font-size: 22px; font-weight: 800; line-height: 1.4; margin: 30px 0 14px; color: var(--spec-font-color-1); }
  .body :global(h3) { font-size: 18px; font-weight: 700; margin: 24px 0 10px; color: var(--spec-font-color-1); }
  .body :global(ul) { margin: 0 0 18px; padding-left: 22px; }
  .body :global(li) { margin-bottom: 8px; line-height: 1.7; }
  .body :global(strong) { font-weight: 700; color: var(--spec-font-color-1); }
  .ai-note { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; padding: 10px 14px; border-radius: 10px; background: var(--spec-background-color-3); border: 1px solid var(--spec-border-level-2); font-size: 12.5px; color: var(--spec-font-color-3); }
  .ai-note b { color: var(--spec-font-color-2); font-weight: 700; }
  :global(.ai-note a) { color: var(--skin-primary-color); }
  .src-cite { margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--spec-border-level-2); font-size: 13px; color: var(--spec-font-color-3); }
  :global(.src-cite a) { color: var(--skin-primary-color); word-break: break-all; }
  .kw { display: flex; flex-wrap: wrap; gap: 8px; margin: 24px 0; }
  .kw span { font-size: 12px; padding: 4px 12px; border-radius: 20px; background: var(--spec-background-color-4); color: var(--spec-font-color-2); border: 1px solid var(--spec-border-level-3); }

  /* Tradeable coins → BYDFi deep links */
  .trade {
    margin: 28px 0; padding: 18px 20px; border-radius: 12px;
    background: var(--skin-brand-bg-color-opacity);
    border: 1px solid rgba(var(--skin-primary-color-rgb), 0.35);
  }
  .trade-h { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--spec-font-color-1); margin-bottom: 4px; }
  .trade-sub { font-size: 12px; color: var(--spec-font-color-3); margin-bottom: 14px; }
  .trade-pairs { display: flex; flex-wrap: wrap; gap: 10px; }
  .trade-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 7px 8px 7px 12px; border-radius: 10px;
    background: var(--spec-background-color-3); border: 1px solid var(--spec-border-level-3);
  }
  :global(.chip-coin) { display: inline-flex; align-items: baseline; gap: 2px; padding-right: 8px; border-right: 1px solid var(--spec-border-level-3); }
  :global(.chip-coin:hover) .chip-base { color: var(--skin-primary-color); }
  .chip-base { font-size: 14px; font-weight: 800; color: var(--spec-font-color-1); transition: color .15s; }
  .chip-quote { font-size: 11px; color: var(--spec-font-color-3); }
  .chip-chg { font-size: 11px; font-weight: 700; margin-left: 4px; }
  .chip-chg.up { color: var(--color-green); }
  .chip-chg.down { color: var(--color-red); }
  :global(.chip-go) {
    font-size: 12px; font-weight: 800; color: var(--spec-brand-bg-font-color);
    background: var(--skin-primary-color); padding: 5px 10px; border-radius: 7px;
    transition: background .15s;
  }
  :global(.chip-go:hover) { background: var(--skin-primary-bg-hover-color); }
  .origin {
    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    margin: 28px 0; padding: 18px 20px; border-radius: 12px;
    background: var(--spec-background-color-3); border: 1px solid var(--spec-border-level-2);
  }
  .origin-note { font-size: 13px; color: var(--spec-font-color-3); line-height: 1.6; }
  :global(.origin-btn) {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 700;
    background: var(--skin-primary-color); color: var(--spec-brand-bg-font-color);
  }
  :global(.origin-btn:hover) { background: var(--skin-primary-bg-hover-color); }
  .cta {
    display: block; margin: 32px 0; padding: 24px; border-radius: 12px; text-align: center;
    background: radial-gradient(120% 120% at 50% 0%, rgba(255,211,15,0.16) 0%, rgba(255,211,15,0) 60%), var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
  }
  .cta-t { font-size: 18px; font-weight: 800; color: var(--spec-font-color-1); }
  .cta-s { font-size: 13px; color: var(--spec-font-color-2); margin: 6px 0 14px; }
  :global(.cta-b) { display: inline-block; padding: 10px 28px; border-radius: 8px; background: var(--skin-primary-color); color: var(--spec-brand-bg-font-color); font-weight: 800; font-size: 14px; }
  .related-h { font-size: 18px; font-weight: 700; color: var(--spec-font-color-1); margin: 40px 0 18px; padding-top: 28px; border-top: 1px solid var(--spec-border-level-2); }
  .related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  @media (max-width: 720px) {
    h1.title { font-size: 25px; }
    .related-grid { grid-template-columns: 1fr; }
  }
`;

export default function ArticleDetail({ item, related, prices = {} }: { item: NewsItem; related: NewsItem[]; prices?: Record<string, CoinPrice> }) {
  const [imgOk, setImgOk] = useState(Boolean(item.image_url));
  const imp = item.importance ? IMPORTANCE_CONFIG[item.importance] : null;
  const sColor = sourceColor(item.source);
  const bg = CATEGORY_BG[item.category] ?? CATEGORY_BG.all;
  const catLabel = CATEGORY_LABELS[item.category] ?? item.category;
  const paragraphs = (item.fulltext || item.content || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const tradePairs = (item.symbols || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => ({ pair, base: pair.split('_')[0], quote: pair.split('_')[1] || 'USDT' }));
  // Tradeable coin chips win — drop keyword chips that duplicate a coin.
  const tradeBases = new Set(tradePairs.map((t) => t.base.toUpperCase()));
  const kws = (item.keywords || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k && !tradeBases.has(k.toUpperCase()))
    .slice(0, 8);

  return (
    <article className="wrap">
      <nav className="crumbs">
        <Link href="/news">首頁</Link><span>/</span>
        <Link href={`/news/${item.category}`}>{catLabel}</Link><span>/</span>
        <span>{(item.article_title || item.title).slice(0, 24)}…</span>
      </nav>

      <div className="meta">
        {imp && <span className="imp" style={{ color: imp.color, background: imp.bg }}>{imp.label}</span>}
        <span className="src" style={{ color: sColor }}>{item.source}</span>
        <time className="time">{fmtDate(item.published_at || item.fetched_at)}</time>
      </div>

      <h1 className="title">{item.article_title || item.title}</h1>

      {imgOk && item.image_url ? (
        <img className="hero-img" src={item.image_url} alt={item.title} referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
      ) : (
        <div className="hero-fallback" style={{ background: bg }}><span style={{ color: sColor }}>{item.source}</span></div>
      )}

      {item.article_md ? (
        <>
          <div className="ai-note">
            <span>✨</span>
            <span><b>AI 編譯整理</b> · 重點摘要與結構化重寫，原文出處見文末</span>
          </div>
          <div className="body">
            <MarkdownArticle md={item.article_md} />
            <div className="src-cite">
              原文出處：<span className="src" style={{ color: sColor }}>{item.source}</span>
              {item.url && <> · <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">查看原始報導 ↗</a></>}
            </div>
          </div>
        </>
      ) : (
        <div className="body">
          {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p>{item.title}</p>}
        </div>
      )}

      {kws.length > 0 && (
        <div className="kw">{kws.map((k) => <span key={k}>{k}</span>)}</div>
      )}

      {tradePairs.length > 0 && (
        <div className="trade">
          <div className="trade-h">💱 本文相關幣種 — 在 BYDFi 交易</div>
          <div className="trade-sub">AI 從內文辨識、並比對 BYDFi 支援的現貨幣對，點擊直接前往交易</div>
          <div className="trade-pairs">
            {tradePairs.map((t) => {
              const chg = prices[t.base.toUpperCase()]?.pct24h;
              return (
                <span key={t.pair} className="trade-chip">
                  <Link href={coinPath(t.base)} className="chip-coin" title={`${t.base} 相關新聞`}>
                    <span className="chip-base">{t.base}</span>
                    <span className="chip-quote">/{t.quote}</span>
                    {chg != null && (
                      <span className={`chip-chg ${chg >= 0 ? 'up' : 'down'}`}>{fmtPct(chg)}</span>
                    )}
                  </Link>
                  <a className="chip-go" href={bydfiSpotUrl(t.pair)} target="_blank" rel="noopener noreferrer">交易 →</a>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="origin">
        <div className="origin-note">本文重點由 BYDFi Crypto News 整理彙編，完整內容請見原始來源 <strong>{item.source}</strong>。</div>
        <a className="origin-btn" href={item.url} target="_blank" rel="noopener noreferrer">閱讀原文 ↗</a>
      </div>

      <a className="cta" href={SIGNUP_URL} target="_blank" rel="noopener noreferrer">
        <div className="cta-t">在 BYDFi 交易 400+ 幣種</div>
        <div className="cta-s">現貨、合約、跟單一站搞定 — 註冊即領 $5 體驗金</div>
        <span className="cta-b">免費註冊 →</span>
      </a>

      {related.length > 0 && (
        <>
          <h2 className="related-h">相關新聞</h2>
          <div className="related-grid">
            {related.slice(0, 3).map((r) => <NewsCard key={r.id} item={r} />)}
          </div>
        </>
      )}

      <style jsx>{styles}</style>
    </article>
  );
}
