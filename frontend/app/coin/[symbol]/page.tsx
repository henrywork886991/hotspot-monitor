import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNewsByCoin, getHotCoins } from '@/lib/db';
import { getCoinPrice } from '@/lib/market-extras';
import { SITE_URL, SITE_NAME, coinName, coinPath, bydfiSpotUrl, articlePath } from '@/lib/site';
import { fmtUsd, fmtPct } from '@/lib/format';
import CoinHub from '@/components/CoinHub';

// ISR: cache the rendered page, regenerate at most every 10 min. Data refreshes
// hourly-ish, so this keeps prices/news fresh while serving cached HTML (fast LCP).
export const revalidate = 600;

// Prerender the hot coins at build (the SEO-critical pages); the long tail is
// generated on-demand and then cached (dynamicParams defaults to true).
export function generateStaticParams() {
  return getHotCoins(120).map((c) => ({ symbol: c.base }));
}

interface Props {
  params: Promise<{ symbol: string }>;
}

function clean(sym: string): string {
  return sym.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const base = clean(symbol);
  const name = coinName(base);
  const url = SITE_URL + coinPath(base);
  const price = getCoinPrice(base);
  const priceStr = price ? `當前價格 ${fmtUsd(price.price)}（24h ${fmtPct(price.pct24h)}）。` : '';
  return {
    title: `${name} (${base}) 最新新聞、價格動態與分析 — BYDFi Crypto News`,
    description: `${name} ${base} 的即時新聞、市場動態與深度分析彙整。${priceStr}在 BYDFi 交易 ${base}/USDT。`,
    alternates: { canonical: url },
    openGraph: { title: `${name} (${base}) 最新新聞與分析`, url, siteName: SITE_NAME, type: 'website' },
  };
}

export default async function CoinPage({ params }: Props) {
  const { symbol } = await params;
  const base = clean(symbol);
  if (!base) notFound();

  const { items, pair } = getNewsByCoin(base, 40);
  if (items.length === 0) notFound();

  const name = coinName(base);
  const tradePair = pair || `${base}_USDT`;
  const url = SITE_URL + coinPath(base);
  const price = getCoinPrice(base);

  // GEO/SEO answer box: 2-3 sentences of concrete, citable facts up top.
  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  const priceSentence = price
    ? `截至 ${today}，${name} 價格為 ${fmtUsd(price.price)}，過去 24 小時${(price.pct24h ?? 0) >= 0 ? '上漲' : '下跌'} ${fmtPct(price.pct24h).replace('-', '')}` +
      `${price.rank ? `，市值排名第 ${price.rank}` : ''}。`
    : '';
  const intro =
    `${name}（${base}）最新動態：BYDFi Crypto News 於過去 72 小時彙整了 ${items.length} 篇 ${name} 相關報導與分析。` +
    `${priceSentence}下方為 ${name} 的即時新聞流，並可一鍵前往 BYDFi 交易 ${tradePair.replace('_', '/')}。`;

  // FAQ — concrete, fact-backed Q&A. Visible on-page AND emitted as FAQPage JSON-LD
  // for Google rich results + GEO citation. Templated, but every answer carries real data.
  const tradeSlash = tradePair.replace('_', '/');
  const faqs: { q: string; a: string }[] = [
    {
      q: `什麼是 ${name}（${base}）？`,
      a: `${name}（${base}）是一種加密貨幣${price?.rank ? `，目前在 CoinGecko 的市值排名約為第 ${price.rank} 名` : ''}。` +
         `你可以在 BYDFi 以 ${tradeSlash} 交易對買賣 ${base}。本頁彙整 ${name} 的最新新聞、市場動態與分析。`,
    },
    ...(price ? [{
      q: `${name}（${base}）現在價格是多少？`,
      a: `截至 ${today}，${name} 價格約為 ${fmtUsd(price.price)}` +
         `${price.pct24h !== null ? `，過去 24 小時${price.pct24h >= 0 ? '上漲' : '下跌'} ${fmtPct(price.pct24h).replace('-', '')}` : ''}。` +
         `加密貨幣價格即時變動，實際成交價請以 BYDFi 行情頁為準。`,
    }] : []),
    {
      q: `如何交易 ${base}／在哪裡可以買 ${name}？`,
      a: `你可以在 BYDFi 現貨市場交易 ${tradeSlash}。前往 BYDFi 的 ${tradeSlash} 交易頁即可下單；` +
         `新用戶完成註冊後可領取體驗金，並支援現貨、合約與跟單交易。`,
    },
    {
      q: `${name} 最近有什麼重要新聞？`,
      a: `過去 72 小時內，BYDFi Crypto News 共彙整了 ${items.length} 篇 ${name} 相關報導，涵蓋最新市場動態、項目進展與分析觀點。完整列表見本頁的即時新聞流。`,
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${name} (${base}) 新聞`,
        url,
        description: intro,
        about: { '@type': 'Thing', name, alternateName: base },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.slice(0, 20).map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: SITE_URL + articlePath(it),
            name: it.title,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'News', item: `${SITE_URL}/news` },
          { '@type': 'ListItem', position: 2, name: `${name} (${base})` },
        ],
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
