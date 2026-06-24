'use client';

import { NewsItem } from '@/types';
import { TopIndex } from '@/lib/market-extras';
import { categoryFullLabel } from '@/lib/site';
import { useLocale } from './LocaleProvider';
import { t } from '@/lib/i18n/messages';
import { INTL_LOCALE } from '@/lib/i18n/config';
import Breadcrumbs from './Breadcrumbs';
import NewsCard from './NewsCard';
import DipChart from './DipChart';
import BacktestTool from './BacktestTool';
import CycleCrossLink from './CycleCrossLink';
import css from 'styled-jsx/css';

export interface CrossLink { href: string; emoji: string; title: string; value: number; label: string; color: string; blurb: string }

// High = hot / closer to a top = danger. (Mirror of the dip scale's colours.)
function zoneColor(v: number): string {
  if (v >= 75) return 'var(--color-red)';
  if (v >= 60) return '#ff6b3d';
  if (v >= 45) return '#f6a623';
  if (v >= 30) return '#9acd32';
  return 'var(--color-green)';
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
    background: radial-gradient(120% 140% at 0% 0%, rgba(246,53,53,0.10) 0%, rgba(246,53,53,0) 55%), var(--spec-background-color-3);
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
  .fired { display: inline-flex; align-items: center; gap: 6px; margin: 12px 0 4px; padding: 5px 12px; border-radius: 999px; font-size: 13px; font-weight: 800; background: var(--spec-background-color-4); color: var(--c); }
  .updated { font-size: 12px; color: var(--spec-font-color-4); margin-top: 12px; }

  .panel { background: var(--spec-background-color-3); border: 1px solid var(--spec-border-level-2); border-radius: 14px; padding: 20px 22px; margin-top: 18px; }
  .panel h2 { font-size: 16px; font-weight: 800; color: var(--spec-font-color-1); margin-bottom: 4px; }
  .panel .sub { font-size: 12px; color: var(--spec-font-color-3); margin-bottom: 16px; }

  /* Signal checklist */
  .sig { display: flex; align-items: center; gap: 14px; padding: 13px 0; border-bottom: 1px solid var(--spec-border-level-1); }
  .sig:last-child { border-bottom: none; }
  .cat { width: 48px; flex-shrink: 0; font-size: 10px; font-weight: 700; text-align: center; padding: 3px 0; border-radius: 5px; background: var(--spec-background-color-4); color: var(--spec-font-color-3); }
  .sig-main { flex: 1; min-width: 0; }
  .sig-name { font-size: 13px; font-weight: 700; color: var(--spec-font-color-1); }
  .sig-detail { font-size: 11px; color: var(--spec-font-color-3); margin-top: 2px; }
  .sig-val { width: 92px; flex-shrink: 0; text-align: right; font-size: 14px; font-weight: 800; color: var(--spec-font-color-1); font-variant-numeric: tabular-nums; }
  .sig-thr { width: 78px; flex-shrink: 0; text-align: right; font-size: 11px; color: var(--spec-font-color-4); font-variant-numeric: tabular-nums; }
  .sig-bar { width: 96px; height: 8px; border-radius: 4px; background: var(--spec-background-color-4); overflow: hidden; flex-shrink: 0; }
  .sig-bar > i { display: block; height: 100%; border-radius: 4px; }
  .badge { width: 52px; flex-shrink: 0; text-align: center; font-size: 11px; font-weight: 800; padding: 4px 0; border-radius: 6px; }
  .badge.on { background: rgba(246,53,53,0.16); color: var(--color-red); }
  .badge.off { background: rgba(0,192,135,0.12); color: var(--color-green); }

  .gainers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 24px; }
  :global(.gainer-row) { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--spec-border-level-1); }
  :global(.gainer-row:hover) .gainer-name { color: var(--skin-primary-color); }
  .gainer-rank { font-size: 11px; color: var(--spec-font-color-4); width: 16px; }
  .gainer-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--spec-font-color-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gainer-price { font-size: 12px; color: var(--spec-font-color-2); }
  .gainer-chg { font-size: 12px; font-weight: 700; color: var(--color-green); width: 64px; text-align: right; }

  .news-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .method { font-size: 13px; line-height: 1.9; color: var(--spec-font-color-2); }
  .method b { color: var(--spec-font-color-1); }
  .disclaimer { font-size: 12px; color: var(--spec-font-color-4); margin-top: 18px; line-height: 1.6; }

  @media (max-width: 900px) {
    .hero { grid-template-columns: 1fr; text-align: center; }
    .gainers, .news-grid { grid-template-columns: 1fr; }
    .sig-thr, .sig-bar { display: none; }
  }
  @media (max-width: 1199px) { .news-grid { grid-template-columns: repeat(2, 1fr); } }
`;

interface Props {
  top: TopIndex;
  snapshot: string;
  gainers: NewsItem[];
  topNews: NewsItem[];
  delta: number | null;
  history: { date: string; value: number }[];
  sibling?: CrossLink | null;
}

export default function TopSignalView({ top, snapshot, gainers, topNews, delta, history, sibling }: Props) {
  const locale = useLocale();
  // GEO-citable fact: consecutive days in the 逃頂 (>=60) zone.
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].value >= 60; i--) streak++;
  const c = zoneColor(top.value);
  const updated = top.updated ? new Date(top.updated).toLocaleString(INTL_LOCALE[locale], { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  return (
    <div className="wrap">
      <Breadcrumbs
        items={[
          { name: categoryFullLabel('crypto', locale), href: `/${locale}/news/crypto` },
          { name: t(locale, 'top.title') },
        ]}
      />

      <section className="hero">
        <div className="gauge" style={{ ['--c' as string]: c, ['--p' as string]: top.value }}>
          <div className="inner">
            <span className="v">{top.value}</span>
            <span className="l">{top.label}</span>
            <span className="s">/ 100</span>
          </div>
        </div>
        <div>
          <h1 className="t">{t(locale, 'top.title')}</h1>
          <div className="fired" style={{ ['--c' as string]: c }}>
            {t(locale, 'top.triggered', { a: top.triggered_count, b: top.total })}
          </div>
          <p className="snap">{snapshot}</p>
          <div className="updated">
            {t(locale, 'top.updated', { time: updated })}
            {delta !== null && <> · {t(locale, 'top.vsYesterday')} <span style={{ color: delta >= 0 ? 'var(--color-red)' : 'var(--color-green)' }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}</span></>}
          </div>
        </div>
      </section>

      {sibling && <CycleCrossLink {...sibling} />}

      {history.length >= 2 && (
        <div className="panel">
          <h2>{t(locale, 'top.chartHeader', { n: history.length })}</h2>
          <div className="sub">
            {streak > 0 ? t(locale, 'top.streak', { n: streak }) : t(locale, 'top.recentRange')}
          </div>
          <DipChart history={history} />
        </div>
      )}

      <div className="panel">
        <h2>{t(locale, 'top.signalsHeader', { n: top.total })}</h2>
        <div className="sub">{t(locale, 'top.signalsSub', { n: top.triggered_count })}</div>
        {top.signals.map((s) => (
          <div key={s.key} className="sig">
            <span className="cat">{s.category}</span>
            <span className="sig-main">
              <div className="sig-name">{s.name}</div>
              <div className="sig-detail">{s.detail}</div>
            </span>
            <span className="sig-val" style={{ color: s.triggered ? 'var(--color-red)' : undefined }}>{s.value}</span>
            <span className="sig-thr">{s.threshold}</span>
            <span className="sig-bar"><i style={{ width: `${s.heat}%`, background: zoneColor(s.heat) }} /></span>
            <span className={`badge ${s.triggered ? 'on' : 'off'}`}>{s.triggered ? t(locale, 'top.triggeredBadge') : t(locale, 'top.notTriggeredBadge')}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>{t(locale, 'top.backtestTitle')}</h2>
        <div className="sub">{t(locale, 'top.backtestSub')}</div>
        <BacktestTool mode="top" />
      </div>

      {gainers.length > 0 && (
        <div className="panel">
          <h2>{t(locale, 'top.gainersHeader')}</h2>
          <div className="sub">{t(locale, 'top.gainersSub')}</div>
          <div className="gainers">
            {gainers.map((it, i) => {
              const { price, chg } = parse(it.content);
              return (
                <a key={it.id} className="gainer-row" href={it.url} target="_blank" rel="noopener noreferrer">
                  <span className="gainer-rank">{i + 1}</span>
                  <span className="gainer-name">{it.title}</span>
                  {price && <span className="gainer-price">{price}</span>}
                  {chg !== null && <span className="gainer-chg">+{chg.toFixed(2)}%</span>}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {topNews.length > 0 && (
        <div className="panel">
          <h2>{t(locale, 'top.newsHeader')}</h2>
          <div className="sub">{t(locale, 'top.newsSub')}</div>
          <div className="news-grid">
            {topNews.slice(0, 8).map((it) => <NewsCard key={it.id} item={it} />)}
          </div>
        </div>
      )}

      <div className="panel">
        <h2>{t(locale, 'top.methodology')}</h2>
        <p className="method">{t(locale, 'top.methodologyProse')}</p>
        <p className="disclaimer">{t(locale, 'top.disclaimer')}</p>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}
