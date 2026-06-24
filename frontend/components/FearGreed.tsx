'use client';

import { FearGreed as FG } from '@/lib/market-extras';
import css from 'styled-jsx/css';
import { useLocale } from './LocaleProvider';
import { t } from '@/lib/i18n/messages';
import type { Locale } from '@/lib/i18n/config';

/* Crypto Fear & Greed Index — contrarian sentiment hook.
   Extreme Fear ≈ 抄底區; we surface it to drive attention when the market dips. */

function color(v: number): string {
  if (v < 25) return 'var(--color-red)';
  if (v < 45) return '#f6a623';
  if (v <= 55) return '#c9cdd4';
  if (v < 75) return '#9acd32';
  return 'var(--color-green)';
}
function hint(v: number, locale: Locale): string {
  if (v < 25) return t(locale, 'fg.extremeFear');
  if (v < 45) return t(locale, 'fg.fear');
  if (v <= 55) return t(locale, 'fg.neutral');
  if (v < 75) return t(locale, 'fg.greed');
  return t(locale, 'fg.extremeGreed');
}

const styles = css`
  .fg { padding: 16px; }
  .fg-top { display: flex; align-items: center; gap: 14px; }
  .gauge {
    --c: var(--color-red);
    position: relative; width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .gauge::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%;
    background: conic-gradient(var(--c) calc(var(--p) * 1%), var(--spec-background-color-4) 0);
    -webkit-mask: radial-gradient(closest-side, transparent 70%, #000 72%);
    mask: radial-gradient(closest-side, transparent 70%, #000 72%);
  }
  .gauge .v { font-size: 20px; font-weight: 900; color: var(--c); line-height: 1; }
  .fg-meta { min-width: 0; }
  .fg-label { font-size: 15px; font-weight: 800; }
  .fg-sub { font-size: 11px; color: var(--spec-font-color-3); margin-top: 2px; }
  .fg-delta { font-size: 11px; margin-top: 3px; }
  .fg-hint {
    font-size: 12px; line-height: 1.5; color: var(--spec-font-color-2);
    margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--spec-border-level-1);
  }
`;

export default function FearGreed({ data }: { data: FG }) {
  const locale = useLocale();
  const c = color(data.value);
  const up = data.delta >= 0;
  return (
    <div className="fg">
      <div className="fg-top">
        <div className="gauge" style={{ ['--c' as string]: c, ['--p' as string]: data.value }}>
          <span className="v">{data.value}</span>
        </div>
        <div className="fg-meta">
          <div className="fg-label" style={{ color: c }}>{locale === 'en' ? data.classification : data.label_zh}</div>
          <div className="fg-sub">{t(locale, 'fg.label')} · {data.classification}</div>
          <div className="fg-delta" style={{ color: up ? 'var(--color-green)' : 'var(--color-red)' }}>
            {up ? '▲' : '▼'} {Math.abs(data.delta)} {t(locale, 'fg.vsYesterday')}
          </div>
        </div>
      </div>
      <div className="fg-hint">{hint(data.value, locale)}</div>
      <style jsx>{styles}</style>
    </div>
  );
}
