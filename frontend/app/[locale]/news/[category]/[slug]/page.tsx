import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNewsById, getRelated, getSitemapEntries } from '@/lib/db';
import { getCoinPrices } from '@/lib/market-extras';
import { SITE_URL, SITE_NAME, articlePath, idFromSlug, slugify, toIso } from '@/lib/site';
import { LOCALES, isLocale, HTML_LANG, type Locale } from '@/lib/i18n/config';
import { altLanguages } from '@/lib/i18n/seo';
import type { NewsItem } from '@/types';
import ArticleDetail from '@/components/ArticleDetail';

// ISR: article content is essentially immutable; the only moving part is the
// price chips. 30-min cache is plenty and makes article pages near-instant.
export const revalidate = 1800;

// Prerender the most recent articles into the ISR cache; older/long-tail URLs
// render on-demand and are then cached (dynamicParams defaults to true).
export function generateStaticParams() {
  const arts = getSitemapEntries(400).map((e) => ({
    category: e.category,
    slug: `${slugify(e.title)}-${e.id}`,
  }));
  return LOCALES.flatMap((locale) => arts.map((a) => ({ locale, ...a })));
}

interface Props {
  params: Promise<{ locale: string; category: string; slug: string }>;
}

function pickDescription(item: NewsItem, isEn: boolean): string {
  // Prefer the rewritten article's Answer-Box lead so the meta description matches
  // the body; fall back to the AI summary, then raw content (per locale).
  const md = isEn ? item.article_md_en : item.article_md;
  let lead = '';
  if (md) {
    lead = md.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('-')) || '';
    lead = lead.replace(/\*\*/g, '');
  }
  const text = lead || (isEn ? item.summary : (item.summary_zh || item.summary)) || item.content || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function pathNoLocale(item: NewsItem, locale: Locale): string {
  return articlePath(item, locale).split('/').slice(2).join('/').replace(/^/, '/');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: loc, slug } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  const isEn = locale === 'en';
  const item = getNewsById(idFromSlug(slug));
  if (!item) return { title: isEn ? 'Article not found — BYDFi Crypto News' : '找不到文章 — BYDFi Crypto News' };

  const desc = pickDescription(item, isEn);
  const displayTitle = isEn ? (item.article_title_en || item.title) : (item.article_title || item.title);
  const ogImage = item.image_url || `${SITE_URL}/opengraph-image`;
  // EN pages without a translated body are thin/duplicate — keep them out of the index.
  const untranslated = isEn && !item.article_md_en;
  return {
    title: `${displayTitle} — BYDFi Crypto News`,
    description: desc,
    alternates: altLanguages(pathNoLocale(item, locale), locale),
    robots: untranslated ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'article', title: displayTitle, description: desc,
      url: `${SITE_URL}${articlePath(item, locale)}`, siteName: SITE_NAME,
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
  const { locale: loc, slug } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  const isEn = locale === 'en';
  const item = getNewsById(idFromSlug(slug));
  if (!item || item.category === 'markets') notFound();

  const related = getRelated(item.category, item.id, 6);
  const desc = pickDescription(item, isEn);
  const url = `${SITE_URL}${articlePath(item, locale)}`;
  const displayTitle = isEn ? (item.article_title_en || item.title) : (item.article_title || item.title);
  const bases = (item.symbols || '').split(',').map((p) => p.split('_')[0].trim()).filter(Boolean);
  const prices = getCoinPrices(bases);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        headline: displayTitle.slice(0, 110),
        description: desc,
        inLanguage: HTML_LANG[locale],
        image: item.image_url ? [item.image_url] : undefined,
        datePublished: toIso(item.published_at) || toIso(item.fetched_at),
        dateModified: toIso(item.fetched_at),
        author: { '@type': 'Organization', name: item.source },
        publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        keywords: item.keywords || undefined,
        isBasedOn: item.url || undefined,
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
