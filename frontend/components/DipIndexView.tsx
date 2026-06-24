'use client';

import { NewsItem } from '@/types';
import { DipIndex } from '@/lib/market-extras';
import { categoryFullLabel } from '@/lib/site';
import { useLocale } from './LocaleProvider';
import { t } from '@/lib/i18n/messages';
import { INTL_LOCALE } from '@/lib/i18n/config';
import Breadcrumbs from './Breadcrumbs';
import NewsCard from './NewsCard';
import DipChart from './DipChart';
import BacktestTool from './BacktestTool';
import CycleCrossLink from './CycleCrossLink';
import type { CrossLink } from './TopSignalView';
import css from 'styled-jsx/css';

function zoneColor(v: number): string {
  if (v >= 75) return 'var(--color-green)';
  if (v >= 60) return '#9acd32';
  if (v >= 45) return '#f6a623';
  if (v >= 30) return '#f6a623';
  return 'var(--color-red)';
}

function parse(content: string | null): { price: string; chg: number | null } {
  const p = content?.match(/Price:\s*([^|]+)/);
  const c = content?.match(/24h:\s*(-?\d+(?:\.\d+)?)%/);
  return { price: p ? p[1].trim() : '', chg: c ? parseFloat(c[1]) : null };
}

const styles = css`
  .wrap { max-width: var(--const-max-page-width); margin: 0 auto; padding: 28px 32px 56px; }

  .hero {
    display: grid; grid-template-columns: 220px 1fr; gap: 28px; align-items: center;
    padding: 28px; border-radius: 16px; margin-bottom: 14px;
    background: radial-gradient(120% 140% at 0% 0%, rgba(255,211,15,0.10) 0%, rgba(255,211,15,0) 55%), var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
  }
  .gauge { position: relative; width: 200px; height: 200px; margin: 0 auto; }
  .gauge::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%;
    background: conic-gradient(var(--c) calc(var(--p) * 1%), var(--spec-background-color-4) 0);
    -webkit-mask: radial-gradient(closest-side, transparent 68%, #000 70%);
    mask: radial-gradient(closest-side, transparent 68%, #000 70%);
  }
  .gauge .inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .gauge .v { font-size: 56px; font-weight: 900; line-height: 1; color: var(--c); }
  .gauge .l { font-size: 16px; font-weight: 800; margin-top: 6px; color: var(--c); }
  .gauge .s { font-size: 11px; color: var(--spec-font-color-3); margin-top: 2px; }
  h1.t { font-size: 26px; font-weight: 900; color: var(--spec-font-color-1); margin-bottom: 10px; }
  .snap { font-size: 15px; line-height: 1.8; color: var(--spec-font-color-2); }
  .updated { font-size: 12px; color: var(--spec-font-color-4); margin-top: 12px; }

  .panel { background: var(--spec-background-color-3); border: 1px solid var(--spec-border-level-2); border-radius: 14px; padding: 20px 22px; margin-top: 18px; }
  .panel h2 { font-size: 16px; font-weight: 800; color: var(--spec-font-color-1); margin-bottom: 4px; }
  .panel .sub { font-size: 12px; color: var(--spec-font-color-3); margin-bottom: 16px; }

  /* Scorecard */
  .comp { display: flex; align-items: center; gap: 14px; padding: 11px 0; border-bottom: 1px solid var(--spec-border-level-1); }
  .comp:last-child { border-bottom: none; }
  .comp-name { width: 92px; flex-shrink: 0; font-size: 13px; font-weight: 700; color: var(--spec-font-color-1); }
  .comp-desc { flex: 1; min-width: 0; font-size: 12px; color: var(--spec-font-color-3); }
  .comp-bar { width: 130px; height: 8px; border-radius: 4px; background: var(--spec-background-color-4); overflow: hidden; flex-shrink: 0; }
  .comp-bar > i { display: block; height: 100%; border-radius: 4px; }
  .comp-score { width: 56px; text-align: right; flex-shrink: 0; font-size: 13px; font-weight: 800; color: var(--spec-font-color-1); }
  .comp-score .w { font-size: 10px; color: var(--spec-font-color-4); font-weight: 500; }

  /* 抄底幣種榜 */
  .losers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 24px; }
  :global(.loser-row) { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--spec-border-level-1); }
  :global(.loser-row:hover) .loser-name { color: var(--skin-primary-color); }
  .loser-rank { font-size: 11px; color: var(--spec-font-color-4); width: 16px; }
  .loser-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--spec-font-color-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loser-price { font-size: 12px; color: var(--spec-font-color-2); }
  .loser-chg { font-size: 12px; font-weight: 700; color: var(--color-red); width: 64px; text-align: right; }

  .news-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .method { font-size: 13px; line-height: 1.9; color: var(--spec-font-color-2); }
  .method b { color: var(--spec-font-color-1); }
  .disclaimer { font-size: 12px; color: var(--spec-font-color-4); margin-top: 18px; line-height: 1.6; }

  @media (max-width: 900px) {
    .hero { grid-template-columns: 1fr; text-align: center; }
    .losers, .news-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 1199px) { .news-grid { grid-template-columns: repeat(2, 1fr); } }
`;

interface Props {
  dip: DipIndex;
  snapshot: string;
  losers: NewsItem[];
  dipNews: NewsItem[];
  delta: number | null;
  history: { date: string; value: number }[];
  sibling?: CrossLink | null;
}

export default function DipIndexView({ dip, snapshot, losers, dipNews, delta, history, sibling }: Props) {
  const locale = useLocale();
  // GEO-citable fact: consecutive days in the 抄底 (>=60) zone.
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].value >= 60; i--) streak++;
  const c = zoneColor(dip.value);
  const updated = dip.updated ? new Date(dip.updated).toLocaleString(INTL_LOCALE[locale], { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  return (
    <div className="wrap">
      <Breadcrumbs
        items={[
          { name: categoryFullLabel('crypto', locale), href: `/${locale}/news/crypto` },
          { name: t(locale, 'dip.title') },
        ]}
      />

      <section className="hero">
        <div className="gauge" style={{ ['--c' as string]: c, ['--p' as string]: dip.value }}>
          <div className="inner">
            <span className="v">{dip.value}</span>
            <span className="l">{dip.label}</span>
            <span className="s">/ 100</span>
          </div>
        </div>
        <div>
          <h1 className="t">{t(locale, 'dip.title')}</h1>
          <p className="snap">{snapshot}</p>
          <div className="updated">
            {t(locale, 'dip.updated', { time: updated })}
            {delta !== null && <> · {t(locale, 'dip.vsYesterday')} <span style={{ color: delta >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}</span></>}
          </div>
        </div>
      </section>

      {sibling && <CycleCrossLink {...sibling} />}

      {history.length >= 2 && (
        <div className="panel">
          <h2>{t(locale, 'dip.chartHeader', { n: history.length })}</h2>
          <div className="sub">
            {streak > 0 ? t(locale, 'dip.streak', { n: streak }) : t(locale, 'dip.recentRange')}
          </div>
          <DipChart history={history} />
        </div>
      )}

      <div className="panel">
        <h2>{t(locale, 'dip.componentsHeader')}</h2>
        <div className="sub">{t(locale, 'dip.componentsSub', { n: dip.components.length })}</div>
        {dip.components.map((co) => (
          <div key={co.name} className="comp">
            <span className="comp-name">{co.name}</span>
            <span className="comp-desc">{co.desc}</span>
            <span className="comp-bar"><i style={{ width: `${co.score}%`, background: zoneColor(co.score) }} /></span>
            <span className="comp-score">{co.score}<span className="w"> ·{co.weight}%</span></span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>{t(locale, 'dip.backtestTitle')}</h2>
        <div className="sub">{t(locale, 'dip.backtestSub')}</div>
        <BacktestTool mode="dip" />
      </div>

      {losers.length > 0 && (
        <div className="panel">
          <h2>{t(locale, 'dip.losersHeader')}</h2>
          <div className="sub">{t(locale, 'dip.losersSub')}</div>
          <div className="losers">
            {losers.map((it, i) => {
              const { price, chg } = parse(it.content);
              return (
                <a key={it.id} className="loser-row" href={it.url} target="_blank" rel="noopener noreferrer">
                  <span className="loser-rank">{i + 1}</span>
                  <span className="loser-name">{it.title}</span>
                  {price && <span className="loser-price">{price}</span>}
                  {chg !== null && <span className="loser-chg">{chg.toFixed(2)}%</span>}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {dipNews.length > 0 && (
        <div className="panel">
          <h2>{t(locale, 'dip.newsHeader')}</h2>
          <div className="sub">{t(locale, 'dip.newsSub')}</div>
          <div className="news-grid">
            {dipNews.slice(0, 8).map((it) => <NewsCard key={it.id} item={it} />)}
          </div>
        </div>
      )}

      <div className="panel">
        <h2>{t(locale, 'dip.methodology')}</h2>
        <p className="method">{t(locale, 'dip.methodologyProse')}</p>
        <p className="disclaimer">{t(locale, 'dip.disclaimer')}</p>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}
