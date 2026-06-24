import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNewsByCoin, getHotCoins } from '@/lib/db';
import { getCoinPrice } from '@/lib/market-extras';
import { SITE_URL, SITE_NAME, coinName, coinPath, bydfiSpotUrl, articlePath, categoryFullLabel } from '@/lib/site';
import { fmtUsd, fmtPct } from '@/lib/format';
import { LOCALES, isLocale, INTL_LOCALE, HTML_LANG } from '@/lib/i18n/config';
import { altLanguages } from '@/lib/i18n/seo';
import Breadcrumbs from '@/components/Breadcrumbs';
import CategoryTabs from '@/components/CategoryTabs';
import CoinHub from '@/components/CoinHub';

// ISR: cache the rendered page, regenerate at most every 10 min. Data refreshes
// hourly-ish, so this keeps prices/news fresh while serving cached HTML (fast LCP).
export const revalidate = 600;

// Prerender the hot coins at build (the SEO-critical pages); the long tail is
// generated on-demand and then cached (dynamicParams defaults to true).
export function generateStaticParams() {
  const coins = getHotCoins(120).map((c) => ({ symbol: c.base }));
  return LOCALES.flatMap((locale) => coins.map((c) => ({ locale, ...c })));
}

interface Props {
  params: Promise<{ locale: string; symbol: string }>;
}

function clean(sym: string): string {
  return sym.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: loc, symbol } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  const isEn = locale === 'en';
  const base = clean(symbol);
  const name = coinName(base);
  const url = `${SITE_URL}${coinPath(base, locale)}`;
  const price = getCoinPrice(base);
  const priceStr = price
    ? (isEn ? `Current price ${fmtUsd(price.price)} (24h ${fmtPct(price.pct24h)}). ` : `當前價格 ${fmtUsd(price.price)}（24h ${fmtPct(price.pct24h)}）。`)
    : '';
  const title = isEn
    ? `${name} (${base}) News, Price & Analysis — BYDFi Crypto News`
    : `${name} (${base}) 最新新聞、價格動態與分析 — BYDFi Crypto News`;
  const description = isEn
    ? `Live ${name} ${base} news, market moves and in-depth analysis. ${priceStr}Trade ${base}/USDT on BYDFi.`
    : `${name} ${base} 的即時新聞、市場動態與深度分析彙整。${priceStr}在 BYDFi 交易 ${base}/USDT。`;
  return {
    title,
    description,
    alternates: altLanguages(`/coin/${base}`, locale),
    openGraph: { title: isEn ? `${name} (${base}) News & Analysis` : `${name} (${base}) 最新新聞與分析`, url, siteName: SITE_NAME, type: 'website' },
  };
}

export default async function CoinPage({ params }: Props) {
  const { locale: loc, symbol } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  const isEn = locale === 'en';
  const base = clean(symbol);
  if (!base) notFound();

  const { items, pair } = getNewsByCoin(base, 40);
  if (items.length === 0) notFound();

  const name = coinName(base);
  const tradePair = pair || `${base}_USDT`;
  const tradeSlash = tradePair.replace('_', '/');
  const url = `${SITE_URL}${coinPath(base, locale)}`;
  const price = getCoinPrice(base);
  const up = (price?.pct24h ?? 0) >= 0;
  const pctAbs = fmtPct(price?.pct24h).replace('-', '');
  const today = new Date().toLocaleDateString(INTL_LOCALE[locale], { year: 'numeric', month: 'long', day: 'numeric' });

  // GEO/SEO answer box + FAQ, per locale (concrete, fact-backed; also emitted as
  // CollectionPage + FAQPage JSON-LD for rich results / AI citation).
  let intro: string;
  let faqs: { q: string; a: string }[];
  if (isEn) {
    const priceSentence = price
      ? `As of ${today}, ${name} trades at ${fmtUsd(price.price)}, ${up ? 'up' : 'down'} ${pctAbs} over 24h${price.rank ? `, ranked #${price.rank} by market cap` : ''}. `
      : '';
    intro =
      `${name} (${base}) update: BYDFi Crypto News compiled ${items.length} ${name} stories and analyses over the past 72 hours. ` +
      `${priceSentence}Below is the live ${name} news feed — trade ${tradeSlash} on BYDFi in one click.`;
    faqs = [
      { q: `What is ${name} (${base})?`,
        a: `${name} (${base}) is a cryptocurrency${price?.rank ? `, currently ranked around #${price.rank} by market cap on CoinGecko` : ''}. You can buy and sell ${base} on BYDFi via the ${tradeSlash} pair. This page aggregates the latest ${name} news, market moves and analysis.` },
      ...(price ? [{ q: `What is the current price of ${name} (${base})?`,
        a: `As of ${today}, ${name} trades at about ${fmtUsd(price.price)}${price.pct24h !== null ? `, ${up ? 'up' : 'down'} ${pctAbs} over the past 24 hours` : ''}. Crypto prices move in real time — see the BYDFi market page for the live price.` }] : []),
      { q: `How do I trade ${base} / where can I buy ${name}?`,
        a: `You can trade ${tradeSlash} on the BYDFi spot market. Head to the BYDFi ${tradeSlash} page to place an order; new users get a trial bonus after signing up, with spot, futures and copy trading supported.` },
      { q: `What's the latest ${name} news?`,
        a: `Over the past 72 hours, BYDFi Crypto News compiled ${items.length} ${name} stories covering the latest market moves, project updates and analysis. See the live feed on this page for the full list.` },
    ];
  } else {
    const priceSentence = price
      ? `截至 ${today}，${name} 價格為 ${fmtUsd(price.price)}，過去 24 小時${up ? '上漲' : '下跌'} ${pctAbs}${price.rank ? `，市值排名第 ${price.rank}` : ''}。`
      : '';
    intro =
      `${name}（${base}）最新動態：BYDFi Crypto News 於過去 72 小時彙整了 ${items.length} 篇 ${name} 相關報導與分析。` +
      `${priceSentence}下方為 ${name} 的即時新聞流，並可一鍵前往 BYDFi 交易 ${tradeSlash}。`;
    faqs = [
      { q: `什麼是 ${name}（${base}）？`,
        a: `${name}（${base}）是一種加密貨幣${price?.rank ? `，目前在 CoinGecko 的市值排名約為第 ${price.rank} 名` : ''}。你可以在 BYDFi 以 ${tradeSlash} 交易對買賣 ${base}。本頁彙整 ${name} 的最新新聞、市場動態與分析。` },
      ...(price ? [{ q: `${name}（${base}）現在價格是多少？`,
        a: `截至 ${today}，${name} 價格約為 ${fmtUsd(price.price)}${price.pct24h !== null ? `，過去 24 小時${up ? '上漲' : '下跌'} ${pctAbs}` : ''}。加密貨幣價格即時變動，實際成交價請以 BYDFi 行情頁為準。` }] : []),
      { q: `如何交易 ${base}／在哪裡可以買 ${name}？`,
        a: `你可以在 BYDFi 現貨市場交易 ${tradeSlash}。前往 BYDFi 的 ${tradeSlash} 交易頁即可下單；新用戶完成註冊後可領取體驗金，並支援現貨、合約與跟單交易。` },
      { q: `${name} 最近有什麼重要新聞？`,
        a: `過去 72 小時內，BYDFi Crypto News 共彙整了 ${items.length} 篇 ${name} 相關報導，涵蓋最新市場動態、項目進展與分析觀點。完整列表見本頁的即時新聞流。` },
    ];
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: isEn ? `${name} (${base}) News` : `${name} (${base}) 新聞`,
        url,
        inLanguage: HTML_LANG[locale],
        description: intro,
        about: { '@type': 'Thing', name, alternateName: base },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.slice(0, 20).map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: SITE_URL + articlePath(it, locale),
            name: (isEn ? it.article_title_en : it.article_title) || it.title,
          })),
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs inset items={[{ name: categoryFullLabel('crypto', locale), href: `/${locale}/news/crypto` }, { name: base }]} />
      <CategoryTabs />
      <CoinHub
        base={base}
        name={name}
        count={items.length}
        tradeUrl={bydfiSpotUrl(tradePair)}
        tradePair={tradePair}
        items={items}
        intro={intro}
        price={price}
        faqs={faqs}
      />
    </>
  );
}
