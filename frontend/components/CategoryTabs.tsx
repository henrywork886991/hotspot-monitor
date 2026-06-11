'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import css from 'styled-jsx/css';

const TABS = [
  // Crypto core (aligned with BYDFi's tradeable markets) first
  { key: 'all',        label: '全部'     },
  { key: 'markets',    label: '行情'     },
  { key: 'crypto',     label: 'Crypto'   },
  { key: 'cn_crypto',  label: '中文幣圈' },
  { key: 'defi',       label: 'DeFi'     },
  { key: 'regulation', label: '監管'     },
  // Broader markets (expansion) after
  { key: 'macro',      label: '宏觀'     },
  { key: 'stocks',     label: '美股'     },
  { key: 'tech',       label: '科技'     },
  { key: 'asia',       label: '亞洲'     },
];

const styles = css`
  .tabs-wrap {
    background: var(--spec-background-color-2);
    border-bottom: 1px solid var(--spec-border-level-1);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .tabs-wrap::-webkit-scrollbar {
    display: none;
  }
  .tabs-inner {
    display: flex;
    align-items: center;
    max-width: var(--const-max-page-width);
    margin: 0 auto;
    padding: 0 32px;
    white-space: nowrap;
    height: var(--const-tab-height);
    gap: 0;
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
  :global(.tab-item:hover) {
    color: var(--spec-font-color-1);
  }
  :global(.tab-item.active) {
    color: var(--skin-primary-color);
    border-bottom-color: var(--skin-primary-color);
    font-weight: 600;
  }
  @media (max-width: 767px) {
    .tabs-inner { padding: 0 16px; }
    :global(.tab-item) { padding: 0 14px; font-size: 13px; }
  }
`;

export default function CategoryTabs() {
  const pathname = usePathname();
  const current = pathname === '/news' ? 'all' : (pathname.split('/').pop() ?? 'all');

  return (
    <div className="tabs-wrap">
      <div className="tabs-inner">
        {TABS.map((tab) => {
          const isActive = tab.key === current;
          const href = tab.key === 'all' ? '/news' : `/news/${tab.key}`;
          return (
            <Link key={tab.key} href={href} className={`tab-item${isActive ? ' active' : ''}`}>
              {tab.label}
            </Link>
          );
        })}
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}
