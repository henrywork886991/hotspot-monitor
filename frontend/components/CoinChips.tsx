'use client';

import Link from 'next/link';
import { coinPath, coinName } from '@/lib/site';
import { fmtPct } from '@/lib/format';
import { CoinPrice } from '@/lib/market-extras';
import { HotCoin } from './NewsSidebar';
import { useLocale } from './LocaleProvider';
import { t } from '@/lib/i18n/messages';
import css from 'styled-jsx/css';

const styles = css`
  .strip { max-width: var(--const-max-page-width); margin: 0 auto; padding: 18px 32px 0; }
  .head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
  .title { font-size: 15px; font-weight: 700; color: var(--spec-font-color-1); }
  .sub { font-size: 12px; color: var(--spec-font-color-3); }
  .row { display: flex; flex-wrap: wrap; gap: 10px; }
  :global(.cc-chip) {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 12px; border-radius: 10px;
    background: var(--spec-background-color-3); border: 1px solid var(--spec-border-level-2);
    transition: border-color .15s, transform .15s;
  }
  :global(.cc-chip:hover) { border-color: var(--skin-primary-color); transform: translateY(-1px); }
  .cc-base { font-size: 14px; font-weight: 800; color: var(--spec-font-color-1); }
  .cc-count { font-size: 11px; color: var(--spec-font-color-3); }
  .cc-chg { font-size: 12px; font-weight: 700; }
  .cc-chg.up { color: var(--color-green); }
  .cc-chg.down { color: var(--color-red); }
  @media (max-width: 767px) { .strip { padding: 14px 16px 0; } }
`;

export default function CoinChips({ coins, prices = {}, label }: {
  coins: HotCoin[]; prices?: Record<string, CoinPrice>; label: string;
}) {
  const locale = useLocale();
  if (coins.length === 0) return null;
  return (
    <div className="strip">
      <div className="head">
        <span className="title">{t(locale, 'chips.title', { label })}</span>
        <span className="sub">{t(locale, 'chips.subtitle')}</span>
      </div>
      <div className="row">
        {coins.map((c) => {
          const chg = prices[c.base.toUpperCase()]?.pct24h;
          return (
            <Link key={c.base} href={coinPath(c.base, locale)} className="cc-chip" title={t(locale, 'card.coinTitle', { c: coinName(c.base) })}>
              <span className="cc-base">{c.base}</span>
              <span className="cc-count">{c.count}</span>
              {chg != null && (
                <span className={`cc-chg ${chg >= 0 ? 'up' : 'down'}`}>{fmtPct(chg)}</span>
              )}
            </Link>
          );
        })}
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}
