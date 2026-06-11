import type { MetadataRoute } from 'next';
import { getSitemapEntries, getHotCoins } from '@/lib/db';
import { SITE_URL, articlePath, coinPath, toIso } from '@/lib/site';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['all', 'crypto', 'defi', 'web3', 'cn_crypto', 'asia', 'stocks', 'macro', 'regulation', 'tech', 'markets'];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const categoryPages: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: c === 'all' ? `${SITE_URL}/news` : `${SITE_URL}/news/${c}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: c === 'all' ? 1 : 0.8,
  }));

  const featurePages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/dip-index`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/top-signal`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
  ];

  const articlePages: MetadataRoute.Sitemap = getSitemapEntries(2000).map((e) => ({
    url: SITE_URL + articlePath(e),
    lastModified: toIso(e.published_at) || toIso(e.fetched_at) || now.toISOString(),
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  const coinPages: MetadataRoute.Sitemap = getHotCoins(120).map((c) => ({
    url: SITE_URL + coinPath(c.base),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [...featurePages, ...categoryPages, ...coinPages, ...articlePages];
}
