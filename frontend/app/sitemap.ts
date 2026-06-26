import type { MetadataRoute } from 'next';
import { getSitemapEntries, getHotCoins } from '@/lib/db';
import { SITE_URL, slugify, toIso } from '@/lib/site';
import { LOCALES, HTML_LANG, DEFAULT_LOCALE } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['all', 'altcoin', 'crypto', 'defi', 'web3', 'cn_crypto', 'asia', 'stocks', 'macro', 'regulation', 'tech', 'markets'];

/** hreflang map for a locale-less path like "/news/crypto". */
function langs(pathNoLocale: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[HTML_LANG[l]] = `${SITE_URL}/${l}${pathNoLocale}`;
  return out;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const entry = (
    pathNoLocale: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
    lastModified: string | Date = now,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}/${DEFAULT_LOCALE}${pathNoLocale}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages: langs(pathNoLocale) },
  });

  const categoryPages = CATEGORIES.map((c) =>
    entry(c === 'all' ? '/news' : `/news/${c}`, c === 'all' ? 1 : 0.8, 'hourly'),
  );

  const featurePages = [
    entry('/dip-index', 0.9, 'hourly'),
    entry('/top-signal', 0.9, 'hourly'),
  ];

  const articlePages = getSitemapEntries(2000).map((e) =>
    entry(
      `/news/${e.category}/${slugify(e.title)}-${e.id}`,
      0.6,
      'daily',
      toIso(e.published_at) || toIso(e.fetched_at) || now.toISOString(),
    ),
  );

  const coinPages = getHotCoins(120).map((c) =>
    entry(`/coin/${c.base.toUpperCase()}`, 0.7, 'daily'),
  );

  return [...featurePages, ...categoryPages, ...coinPages, ...articlePages];
}
