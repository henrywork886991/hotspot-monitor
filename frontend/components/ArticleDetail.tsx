'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NewsItem } from '@/types';
import { parseUtc, fmtPct } from '@/lib/format';
import { CoinPrice } from '@/lib/market-extras';
import { IMPORTANCE_CONFIG, sourceColor } from '@/lib/news-style';
import { coinPath, bydfiSpotUrl, categoryFullLabel } from '@/lib/site';
import { useLocale } from './LocaleProvider';
import { t } from '@/lib/i18n/messages';
import { INTL_LOCALE, type Locale } from '@/lib/i18n/config';
import Breadcrumbs from './Breadcrumbs';
import CoverFallback from './CoverFallback';
import NewsCard from './NewsCard';
import MarkdownArticle from './MarkdownArticle';
import css from 'styled-jsx/css';

const SIGNUP_URL = 'https://www.bydfi.com/en/register';

function fmtDate(s: string | null, locale: Locale): string {
  if (!s) return '';
  const ts = parseUtc(s);
  if (Number.isNaN(ts)) return '';
  return new Date(ts).toLocaleString(INTL_LOCALE[locale], { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = css`
  .wrap { max-width: 820px; margin: 0 auto; padding: 28px 24px 64px; }
  .meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; font-size: 13px; }
  .imp { font-weight: 700; padding: 3px 9px; border-radius: 5px; }
  .src { font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .time { color: var(--spec-font-color-3); }
  h1.title { font-size: 32px; font-weight: 800; line-height: 1.3; color: var(--spec-font-color-1); margin-bottom: 20px; }
  .hero-img { width: 100%; max-height: 440px; object-fit: cover; border-radius: 12px; display: block; margin-bottom: 24px; background: var(--spec-background-color-3); }
  .hero-fallback { width: 100%; height: 240px; border-radius: 12px; margin-bottom: 24px; overflow: hidden; }
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
  const locale = useLocale();
  const isEn = locale === 'en';
  const [imgOk, setImgOk] = useState(Boolean(item.image_url));
  const imp = item.importance ? IMPORTANCE_CONFIG[item.importance] : null;
  const sColor = sourceColor(item.source);
  const catLabel = categoryFullLabel(item.category, locale);
  // Per-locale content: EN reads the *_en rewrite (falls back to the original
  // source title when not yet translated); ZH reads the zh rewrite.
  const displayTitle = isEn ? (item.article_title_en || item.title) : (item.article_title || item.title);
  const bodyMd = isEn ? item.article_md_en : item.article_md;
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

  // Breadcrumb = 賽道 → 幣對 → 新聞 (no generic Home). The coin level is added
  // only when the article is tagged to a tradeable coin, and links to its hub.
  const primaryBase = tradePairs[0]?.base?.toUpperCase() || '';

  return (
    <article className="wrap">
      <Breadcrumbs
        items={[
          { name: catLabel, href: `/${locale}/news/${item.category}` },
          ...(primaryBase ? [{ name: primaryBase, href: coinPath(primaryBase, locale) }] : []),
          { name: displayTitle },
        ]}
      />

      <div className="meta">
        {imp && <span className="imp" style={{ color: imp.color, background: imp.bg }}>{imp.label}</span>}
        <span className="src" style={{ color: sColor }}>{item.source}</span>
        <time className="time">{fmtDate(item.published_at || item.fetched_at, locale)}</time>
      </div>

      <h1 className="title">{displayTitle}</h1>

      {imgOk && item.image_url ? (
        <img className="hero-img" src={item.image_url} alt={item.title} referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
      ) : (
        <div className="hero-fallback"><CoverFallback item={item} variant="article" /></div>
      )}

      {bodyMd ? (
        <>
          <div className="ai-note">
            <span>✨</span>
            <span><b>{t(locale, 'article.aiNote')}</b> · {t(locale, 'article.aiNoteDesc')}</span>
          </div>
          <div className="body">
            <MarkdownArticle md={bodyMd} />
            <div className="src-cite">
              {t(locale, 'article.aiNoteDesc')} · <span className="src" style={{ color: sColor }}>{item.source}</span>
              {item.url && <> · <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">{t(locale, 'article.readOriginal')}</a></>}
            </div>
          </div>
        </>
      ) : (
        <div className="body">
          {isEn && <div className="ai-note"><span>🌐</span><span>{t(locale, 'article.translating')}</span></div>}
          {isEn && item.summary && <p>{item.summary}</p>}
          {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p>{displayTitle}</p>}
        </div>
      )}

      {kws.length > 0 && (
        <div className="kw">{kws.map((k) => <span key={k}>{k}</span>)}</div>
      )}

      {tradePairs.length > 0 && (
        <div className="trade">
          <div className="trade-h">{t(locale, 'article.tradeHeader')}</div>
          <div className="trade-sub">{t(locale, 'article.tradeSub')}</div>
          <div className="trade-pairs">
            {tradePairs.map((tp) => {
              const chg = prices[tp.base.toUpperCase()]?.pct24h;
              return (
                <span key={tp.pair} className="trade-chip">
                  <Link href={coinPath(tp.base, locale)} className="chip-coin" title={t(locale, 'card.coinTitle', { c: tp.base })}>
                    <span className="chip-base">{tp.base}</span>
                    <span className="chip-quote">/{tp.quote}</span>
                    {chg != null && (
                      <span className={`chip-chg ${chg >= 0 ? 'up' : 'down'}`}>{fmtPct(chg)}</span>
                    )}
                  </Link>
                  <a className="chip-go" href={bydfiSpotUrl(tp.pair)} target="_blank" rel="noopener noreferrer">{t(locale, 'article.tradeGo')}</a>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="origin">
        <div className="origin-note">{t(locale, 'article.originNote', { source: item.source })}</div>
        <a className="origin-btn" href={item.url} target="_blank" rel="noopener noreferrer">{t(locale, 'article.readOriginal')}</a>
      </div>

      <a className="cta" href={SIGNUP_URL} target="_blank" rel="noopener noreferrer">
        <div className="cta-t">{t(locale, 'article.ctaTitle')}</div>
        <div className="cta-s">{t(locale, 'article.ctaSub')}</div>
        <span className="cta-b">{t(locale, 'article.ctaBtn')}</span>
      </a>

      {related.length > 0 && (
        <>
          <h2 className="related-h">{t(locale, 'article.related')}</h2>
          <div className="related-grid">
            {related.slice(0, 3).map((r) => <NewsCard key={r.id} item={r} />)}
          </div>
        </>
      )}

      <style jsx>{styles}</style>
    </article>
  );
}
