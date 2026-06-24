'use client';

import Link from 'next/link';
import css from 'styled-jsx/css';
import { SITE_URL } from '@/lib/site';

export interface Crumb {
  name: string;
  /** Omit on the current (last) page — Google then uses the page's own URL. */
  href?: string;
}

const styles = css`
  .crumb-bar { margin-bottom: 18px; }
  .crumb-bar.inset {
    max-width: var(--const-max-page-width);
    margin: 0 auto;
    padding: 16px 32px 0;
  }
  .crumbs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--spec-font-color-3);
  }
  .crumbs :global(a) {
    color: var(--spec-font-color-3);
    text-decoration: none;
  }
  .crumbs :global(a:hover) {
    color: var(--skin-primary-color);
  }
  .current {
    color: var(--spec-font-color-2);
    display: inline-block;
    max-width: 52ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }
  @media (max-width: 767px) {
    .current { max-width: 22ch; }
  }
  .sep {
    opacity: 0.5;
  }
  @media (max-width: 767px) {
    .crumb-bar.inset { padding: 12px 16px 0; }
  }
`;

/**
 * One source of truth for breadcrumbs: renders the visible trail AND the
 * matching BreadcrumbList JSON-LD, so the two can never drift apart.
 * Pass `inset` when used stand-alone (e.g. above the tab bar) so it picks up
 * the page's max-width gutter; leave it off inside an already-padded wrapper.
 */
export default function Breadcrumbs({ items, inset = false }: { items: Crumb[]; inset?: boolean }) {
  // Google needs at least two items; a lone crumb (the home root) isn't useful.
  if (items.length < 2) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.href ? { item: c.href.startsWith('http') ? c.href : `${SITE_URL}${c.href}` } : {}),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={inset ? 'crumb-bar inset' : 'crumb-bar'}>
        <nav className="crumbs" aria-label="breadcrumb">
          {items.map((c, i) => (
            <span className="item" key={i}>
              {i > 0 && <span className="sep" aria-hidden="true">/&nbsp;</span>}
              {c.href ? (
                <Link href={c.href}>{c.name}</Link>
              ) : (
                <span className="current" aria-current="page">{c.name}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
      <style jsx>{styles}</style>
    </>
  );
}
