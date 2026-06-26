'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import css from 'styled-jsx/css';
import { coinPath, categoryLabel } from '@/lib/site';
import { useLocale } from './LocaleProvider';
import { t } from '@/lib/i18n/messages';

// Crypto-first primary nav: lead with the coins users actually search for, then a
// 更多 dropdown that keeps every existing track one click away (nothing removed).
const COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'TRX', 'DOGE', 'ADA'];

// This build is Crypto-only: the broader-market tracks (parallel to Crypto, not
// crypto-native) are hidden, not deleted — flip `hidden` to restore them. Their
// pages still exist and stay reachable by URL. Labels come from categoryLabel().
const MORE = [
  { key: 'markets' },
  { key: 'crypto' },
  { key: 'cn_crypto' },
  { key: 'defi' },
  { key: 'regulation' },
  { key: 'macro', hidden: true },
  { key: 'stocks', hidden: true },
  { key: 'tech', hidden: true },
  { key: 'asia', hidden: true },
];
const VISIBLE_MORE = MORE.filter((m) => !m.hidden);
const MORE_KEYS = new Set(VISIBLE_MORE.map((m) => m.key));

const styles = css`
  .tabs-wrap {
    background: var(--spec-background-color-2);
    border-bottom: 1px solid var(--spec-border-level-1);
  }
  .tabs-inner {
    display: flex;
    align-items: center;
    max-width: var(--const-max-page-width);
    margin: 0 auto;
    padding: 0 32px;
    height: var(--const-tab-height);
  }
  .scroller {
    display: flex;
    align-items: center;
    flex: 0 1 auto;
    min-width: 0;
    height: 100%;
    white-space: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .scroller::-webkit-scrollbar { display: none; }
  .more {
    position: relative;
    flex: 0 0 auto;
    height: 100%;
    display: flex;
    align-items: center;
  }
  :global(.tab-item) {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 20px;
    font-size: 14px;
    font-weight: 500;
    color: var(--spec-font-color-2);
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
    box-sizing: border-box;
  }
  :global(.tab-item:hover) { color: var(--spec-font-color-1); }
  :global(.tab-item.active) {
    color: var(--skin-primary-color);
    border-bottom-color: var(--skin-primary-color);
    font-weight: 600;
  }
  .more-btn {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-family: inherit;
    gap: 5px;
  }
  .caret { font-size: 10px; transition: transform 0.15s; }
  .caret.up { transform: rotate(180deg); }
  .menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 148px;
    padding: 6px;
    background: var(--spec-background-color-2);
    border: 1px solid var(--spec-border-level-1);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 50;
    display: flex;
    flex-direction: column;
  }
  :global(.menu-item) {
    padding: 9px 12px;
    font-size: 14px;
    border-radius: 6px;
    color: var(--spec-font-color-2);
    text-decoration: none;
    white-space: nowrap;
  }
  :global(.menu-item:hover) {
    background: var(--spec-background-color-3);
    color: var(--spec-font-color-1);
  }
  :global(.menu-item.active) { color: var(--skin-primary-color); font-weight: 600; }
  @media (max-width: 767px) {
    .tabs-inner { padding: 0 16px; }
    :global(.tab-item) { padding: 0 14px; font-size: 13px; }
  }
`;

export default function CategoryTabs() {
  const pathname = usePathname();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on any click outside it (menu items close it on click).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // pathname is locale-prefixed: /<locale>/<section>/<rest>
  const seg = pathname.split('/').filter(Boolean).slice(1);
  const coin = seg[0] === 'coin' ? decodeURIComponent(seg[1] ?? '').toUpperCase() : null;
  const isAll = seg[0] === 'news' && !seg[1];
  const cat = seg[0] === 'news' ? seg[1] ?? null : null;
  const moreActive = !!cat && MORE_KEYS.has(cat);

  return (
    <div className="tabs-wrap">
      <div className="tabs-inner">
        <div className="scroller">
          <Link href={`/${locale}/news`} className={`tab-item${isAll ? ' active' : ''}`}>{t(locale, 'nav.all')}</Link>
          {COINS.map((c) => (
            <Link key={c} href={coinPath(c, locale)} className={`tab-item${coin === c ? ' active' : ''}`}>{c}</Link>
          ))}
          <Link href={`/${locale}/news/altcoin`} className={`tab-item${cat === 'altcoin' ? ' active' : ''}`}>{t(locale, 'nav.altcoin')}</Link>
        </div>
        <div className="more" ref={moreRef}>
          <button
            type="button"
            className={`tab-item more-btn${moreActive ? ' active' : ''}`}
            aria-haspopup="true"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {t(locale, 'nav.more')} <span className={`caret${open ? ' up' : ''}`} aria-hidden="true">▾</span>
          </button>
          {open && (
            <div className="menu" role="menu">
              {VISIBLE_MORE.map((m) => (
                <Link
                  key={m.key}
                  href={`/${locale}/news/${m.key}`}
                  className={`menu-item${cat === m.key ? ' active' : ''}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {categoryLabel(m.key, locale)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}
