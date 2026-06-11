import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNewsById, getRelated, getSitemapEntries } from '@/lib/db';
import { getCoinPrices } from '@/lib/market-extras';
import { SITE_URL, SITE_NAME, articlePath, idFromSlug, categoryLabel, slugify, toIso } from '@/lib/site';
import ArticleDetail from '@/components/ArticleDetail';

// ISR: article content is essentially immutable; the only moving part is the
// price chips. 30-min cache is plenty and makes article pages near-instant.
export const revalidate = 1800;

// Prerender the most recent articles into the ISR cache; older/long-tail URLs
// render on-demand and are then cached (dynamicParams defaults to true).
export function generateStaticParams() {
  return getSitemapEntries(400).map((e) => ({
    category: e.category,
    slug: `${slugify(e.title)}-${e.id}`,
  }));
}

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

function pickDescription(item: { article_md?: string | null; summary: string | null; content: string | null }): string {
  // Prefer the rewritten article's Answer-Box lead so the meta description matches
  // the unified-language body; fall back to the AI summary, then raw content.
  let lead = '';
  if (item.article_md) {
    lead = item.article_md
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#') && !l.startsWith('-')) || '';
    lead = lead.replace(/\*\*/g, '');
  }
  const text = lead || item.summary || item.content || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = getNewsById(idFromSlug(slug));
  if (!item) return { title: '找不到文章 — BYDFi Crypto News' };

  const desc = pickDescription(item);
  const url = SITE_URL + articlePath(item);
  const displayTitle = item.article_title || item.title;
  // Cover image if we have one; otherwise the branded default OG card so every
  // article still shares with an image (most skip-sources have no scrapable cover).
  const ogImage = item.image_url || `${SITE_URL}/opengraph-image`;
  return {
    title: `${displayTitle} — BYDFi Crypto News`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: 'article', title: displayTitle, description: desc, url, siteName: SITE_NAME,
      images: [{ url: ogImage }],
      publishedTime: toIso(item.published_at) || undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle, description: desc,
      images: [ogImage],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { category, slug } = await params;
  const item = getNewsById(idFromSlug(slug));
  if (!item || item.category === 'markets') notFound();

  const related = getRelated(item.category, item.id, 6);
  const desc = pickDescription(item);
  const url = SITE_URL + articlePath(item);
  const bases = (item.symbols || '').split(',').map((p) => p.split('_')[0].trim()).filter(Boolean);
  const prices = getCoinPrices(bases);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        headline: (item.article_title || item.title).slice(0, 110),
        description: desc,
        image: item.image_url ? [item.image_url] : undefined,
        datePublished: toIso(item.published_at) || toIso(item.fetched_at),
        dateModified: toIso(item.fetched_at),
        author: { '@type': 'Organization', name: item.source },
        publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        keywords: item.keywords || undefined,
        isBasedOn: item.url || undefined,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'News', item: `${SITE_URL}/news` },
          { '@type': 'ListItem', position: 2, name: categoryLabel(item.category), item: `${SITE_URL}/news/${category}` },
          { '@type': 'ListItem', position: 3, name: item.title.slice(0, 60) },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ArticleDetail item={item} related={related} prices={prices} />
    </>
  );
}
