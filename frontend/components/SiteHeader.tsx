'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import css from 'styled-jsx/css';

/* Faithful replica of the bydfi.com/en top navigation.
   Logo SVG extracted verbatim from the live BYDFi site (white wordmark + yellow `currentColor` accents).
   Re-styled with hotspot-monitor's design tokens. Trading links point to real bydfi.com;
   News routes to our product. */

type NavItem = { label: string; href: string; external?: boolean; caret?: boolean; gold?: boolean };

const MAIN_NAV: NavItem[] = [
  { label: 'Buy Crypto',   href: 'https://www.bydfi.com/en/buy-crypto',           external: true, caret: true },
  { label: 'Markets',      href: 'https://www.bydfi.com/en/markets',              external: true },
  { label: 'Trade',        href: 'https://www.bydfi.com/en/spot',                 external: true, caret: true },
  { label: 'Futures',      href: 'https://www.bydfi.com/en/futures',              external: true, caret: true },
  { label: 'GOLD',         href: 'https://www.bydfi.com/en',                      external: true, gold: true },
  { label: 'Copy',         href: 'https://www.bydfi.com/en/futures-copy-trading', external: true },
  { label: 'Trading Bots', href: 'https://www.bydfi.com/en/trading-bot',          external: true, caret: true },
  { label: 'Events',       href: 'https://www.bydfi.com/en',                      external: true },
  { label: 'BYDFi Card',   href: 'https://www.bydfi.com/en',                      external: true },
  { label: 'News',         href: '/news' },
];

const LOGIN_URL = 'https://www.bydfi.com/en/login';
const SIGNUP_URL = 'https://www.bydfi.com/en/register';

/* ---- Icons ---- */
function BydfiLogo() {
  return (
    <svg width="82" height="20" viewBox="0 0 82 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--skin-primary-color)' }} aria-label="BYDFi">
      <path d="M6.37658 0H0L7.94908 13.4604L11.1229 8.07627L6.37658 0Z" fill="white" />
      <path d="M17.254 0V0.0281894L16.374 1.50813L19.5623 6.89231L23.6306 0H17.254Z" fill="currentColor" />
      <path d="M9.31965 2.69165L12.5224 8.07583L11.8155 9.23159L8.6416 14.6158L11.123 18.8442L11.8155 19.9999L14.9893 14.6158L18.8701 8.07583L15.6962 2.69165H9.31965Z" fill="currentColor" />
      <path d="M76.8799 3.42505H66.4639V16.5754H69.6233V6.13123H76.8799V3.42505Z" fill="white" />
      <path d="M75.4645 8.79565H71.1221V11.2904H75.4645V8.79565Z" fill="white" />
      <path d="M81.9997 7.59741H79.0566V16.5757H81.9997V7.59741Z" fill="white" />
      <path d="M81.9997 3.42505H79.0566V6.13123H81.9997V3.42505Z" fill="currentColor" />
      <path d="M36.9181 9.80995C37.6394 9.38711 37.9424 8.01992 37.9424 7.47023V7.44204C37.9424 5.21508 36.0957 3.42505 33.8308 3.42505H28.0312V6.18761H33.5855C34.2924 6.18761 34.8695 6.7514 34.8695 7.44204C34.8695 8.13268 34.2924 8.69647 33.5855 8.69647H28.0312V16.5895H34.48C36.6728 16.5895 38.4473 14.8559 38.4473 12.7135V12.6994C38.4184 11.9946 38.4184 10.5429 36.9181 9.80995ZM35.4321 12.6994C35.4321 13.4746 34.7829 14.1088 33.9895 14.1088H31.0031V11.2899H33.9895C34.7829 11.2899 35.4321 11.9242 35.4321 12.6994Z" fill="white" />
      <path d="M47.3485 3.42505H50.6089L46.2376 10.416V16.5754H43.208V10.416L47.3485 3.42505Z" fill="white" />
      <path d="M52.7734 3.42505V16.5895H56.4378H57.4765C61.2419 16.5895 64.2859 13.6014 64.2859 9.9368V9.76767V9.73948C64.2859 6.25809 61.4006 3.42505 57.8228 3.42505H57.1736V5.87753H57.188C59.4385 5.87753 61.2707 7.66756 61.2707 9.86633C61.2707 12.1779 59.352 14.0525 56.986 14.0525H55.6443V3.42505H52.7734Z" fill="white" />
      <path d="M42.3415 8.93608L45.6019 3.42505H39.0811L42.3415 8.93608Z" fill="currentColor" />
    </svg>
  );
}
const Flame = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2c.6 3.1-1.3 4.7-2.8 6.1C7.5 9.7 6 11.2 6 14a6 6 0 0012 0c0-2-.9-3.6-2-5 .2 1.2-.4 2.2-1.3 2.6.6-2.1-.4-4.6-2.7-9.6z" />
  </svg>
);
const Caret = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);
const GridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {[4, 10.5, 17].flatMap((y) => [4, 10.5, 17].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
  </svg>
);
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);
const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M12 3v11m0 0l4-4m-4 4l-4-4" /><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" /></svg>
);
const GlobeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>
);
const GiftIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 7h-2.2a2.8 2.8 0 00.2-1 2.8 2.8 0 00-5-1.7A2.8 2.8 0 008 6a2.8 2.8 0 00.2 1H6a2 2 0 00-2 2v2h7V7h2v4h7V9a2 2 0 00-2-2zm-9-1a.8.8 0 11-.8.8.8.8 0 01.8-.8zm4 .8a.8.8 0 11.8.8.8.8 0 01-.8-.8zM4 13v6a2 2 0 002 2h5v-8H4zm9 8h5a2 2 0 002-2v-6h-7v8z" /></svg>
);

const styles = css`
  .site-header {
    position: sticky;
    top: 0;
    z-index: 200;
    background: var(--spec-background-color-2);
    border-bottom: 1px solid var(--spec-border-level-1);
  }
  .header-inner {
    max-width: var(--const-max-page-width);
    margin: 0 auto;
    padding: 0 20px;
    height: var(--const-nav-height);
    display: flex;
    align-items: center;
    gap: 14px;
  }

  /* ---- Left ---- */
  .brand { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
  :global(.brand-logo) { display: flex; align-items: center; }
  .product-tabs { display: flex; align-items: center; gap: 2px; }
  :global(.product-tab) {
    display: flex; align-items: center; gap: 5px;
    font-size: 14px; font-weight: 600;
    color: var(--spec-font-color-1);
    padding: 6px 10px; border-radius: 6px;
    transition: color .15s, background .15s;
  }
  :global(.product-tab:hover) { background: var(--spec-background-color-4); }
  .product-tab .flame { color: #f5a623; display: inline-flex; }
  .grid-btn {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border: none; border-radius: 6px;
    background: transparent; color: var(--spec-font-color-2); cursor: pointer;
    transition: color .15s, background .15s;
  }
  .grid-btn:hover { color: var(--spec-font-color-1); background: var(--spec-background-color-4); }

  /* ---- Center main nav ---- */
  .main-nav { display: flex; align-items: center; gap: 1px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .main-nav::-webkit-scrollbar { display: none; }
  :global(.nav-link) {
    display: flex; align-items: center; gap: 4px;
    font-size: 14px; font-weight: 500;
    color: var(--spec-font-color-1);
    padding: 8px 10px; border-radius: 6px; white-space: nowrap;
    transition: color .15s, background .15s;
  }
  :global(.nav-link:hover) { background: var(--spec-background-color-4); }
  :global(.nav-link.active) { color: var(--skin-primary-color); }
  :global(.nav-link.gold) { color: #f7a600; font-weight: 700; }
  :global(.nav-link.gold .flame) { color: #f7a600; display: inline-flex; }
  :global(.nav-link .caret) { color: var(--spec-font-color-3); display: inline-flex; }

  /* ---- Right ---- */
  .actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border: none; border-radius: 8px;
    background: transparent; color: var(--spec-font-color-2); cursor: pointer;
    transition: color .15s, background .15s;
  }
  .icon-btn:hover { color: var(--spec-font-color-1); background: var(--spec-background-color-4); }
  .login-btn {
    font-size: 14px; font-weight: 600; color: var(--spec-font-color-1);
    padding: 8px 12px; border-radius: 8px; transition: background .15s;
  }
  .login-btn:hover { background: var(--spec-background-color-4); }
  .signup-btn {
    display: flex; align-items: center; gap: 6px;
    font-size: 14px; font-weight: 700;
    color: var(--spec-brand-bg-font-color); background: var(--skin-primary-color);
    padding: 8px 16px; border-radius: 8px; white-space: nowrap;
    margin: 0 4px; transition: background .15s;
  }
  .signup-btn:hover { background: var(--skin-primary-bg-hover-color); }
  .hamburger { display: none; }

  /* ---- Search overlay ---- */
  .search-bar {
    max-width: var(--const-max-page-width); margin: 0 auto;
    padding: 0 20px 12px; display: flex;
  }
  .search-bar input {
    flex: 1; height: 40px; padding: 0 14px;
    background: var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-3); border-radius: 8px;
    color: var(--spec-font-color-1); font-size: 14px; outline: none;
  }
  .search-bar input:focus { border-color: var(--skin-primary-color); }

  /* ---- Mobile drawer ---- */
  .mobile-drawer { display: none; flex-direction: column; padding: 8px 16px 16px; border-top: 1px solid var(--spec-border-level-1); background: var(--spec-background-color-1); }
  :global(.mobile-link) { font-size: 15px; font-weight: 500; color: var(--spec-font-color-1); padding: 12px 4px; border-bottom: 1px solid var(--spec-border-level-1); }
  :global(.mobile-link.active) { color: var(--skin-primary-color); }

  @media (max-width: 1180px) { .product-tabs, .grid-btn { display: none; } }
  @media (max-width: 960px) {
    .main-nav, .login-btn { display: none; }
    .hamburger { display: flex; }
    .mobile-drawer.open { display: flex; }
  }
`;

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const onNews = pathname.startsWith('/news');
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchOpen(false);
    router.push(`/news?q=${encodeURIComponent(q)}`);
  }

  function navItem(item: NavItem, base: string, onClick?: () => void) {
    const isActive = item.href === '/news' && onNews;
    const className = [base, item.gold ? 'gold' : '', isActive ? 'active' : ''].filter(Boolean).join(' ');
    const inner = (
      <>
        {item.gold && <span className="flame"><Flame /></span>}
        {item.label}
        {item.caret && <span className="caret"><Caret /></span>}
      </>
    );
    return item.external ? (
      <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>{inner}</a>
    ) : (
      <Link key={item.label} href={item.href} className={className} onClick={onClick}>{inner}</Link>
    );
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand">
          <Link href="/news" className="brand-logo"><BydfiLogo /></Link>
          <nav className="product-tabs">
            <a href="https://www.bydfi.com/en" target="_blank" rel="noopener noreferrer" className="product-tab">Exchange</a>
            <a href="https://www.bydfi.com/en/moonx/markets/trending" target="_blank" rel="noopener noreferrer" className="product-tab">
              <span className="flame"><Flame /></span>MoonX
            </a>
          </nav>
          <button className="grid-btn" aria-label="All products" type="button"><GridIcon /></button>
        </div>

        <nav className="main-nav">
          {MAIN_NAV.map((item) => navItem(item, 'nav-link'))}
        </nav>

        <div className="actions">
          <button className="icon-btn" aria-label="Search" type="button" onClick={() => setSearchOpen((v) => !v)}><SearchIcon /></button>
          <a href={LOGIN_URL} target="_blank" rel="noopener noreferrer" className="login-btn">Log In</a>
          <a href={SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="signup-btn"><GiftIcon />Sign Up</a>
          <button className="icon-btn" aria-label="Download app" type="button"><DownloadIcon /></button>
          <button className="icon-btn" aria-label="Language" type="button"><GlobeIcon /></button>
          <button className="hamburger icon-btn" aria-label="Menu" type="button" onClick={() => setOpen((v) => !v)}>
            {open
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 18L18 6M6 6l12 12" /></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>}
          </button>
        </div>
      </div>

      {searchOpen && (
        <form className="search-bar" onSubmit={submitSearch}>
          <input
            type="search"
            placeholder="搜尋新聞、幣種、關鍵字…（Enter 搜尋）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </form>
      )}

      <div className={`mobile-drawer${open ? ' open' : ''}`}>
        {MAIN_NAV.map((item) => navItem(item, 'mobile-link', () => setOpen(false)))}
      </div>

      <style jsx>{styles}</style>
    </header>
  );
}
