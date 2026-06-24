import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDipIndex, getDipHistory, getTopIndex } from '@/lib/market-extras';
import { getDipNews, getMarkets } from '@/lib/db';
import { SITE_URL, SITE_NAME } from '@/lib/site';
import { isLocale, HTML_LANG, INTL_LOCALE, type Locale } from '@/lib/i18n/config';
import { altLanguages } from '@/lib/i18n/seo';
import DipIndexView from '@/components/DipIndexView';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

// Top index uses the red-high scale (high = overheated = distribution risk).
function topColor(v: number): string {
  if (v >= 75) return 'var(--color-red)';
  if (v >= 60) return '#ff6b3d';
  if (v >= 45) return '#f6a623';
  return 'var(--color-green)';
}

function snapshot(value: number, label: string, comps: { name: string; score: number }[], locale: Locale): string {
  const today = new Date().toLocaleDateString(INTL_LOCALE[locale], { year: 'numeric', month: 'long', day: 'numeric' });
  const sep = locale === 'en' ? ', ' : '、';
  const top = [...comps].sort((a, b) => b.score - a.score).slice(0, 3).map((c) => c.name).join(sep);
  if (locale === 'en') {
    return `As of ${today}, the BYDFi Dip Index reads ${value} (${label}). It blends on-chain valuation (MVRV-Z, NUPL), technicals (200-day MA, RSI, drawdown), sentiment (Fear & Greed, funding rate) and an exclusive news-fear gauge; right now ${top} stand out most, the market leans fearful/oversold, and historically similar zones have marked better accumulation windows for crypto.`;
  }
  return `截至 ${today}，BYDFi 抄底指數為 ${value}（${label}）。指數整合鏈上估值（MVRV-Z、NUPL）、技術面（200 日均線、RSI、回調幅度）、市場情緒（恐懼貪婪指數、資金費率）與獨家新聞恐慌度等多維度訊號，目前以 ${top} 等訊號最為突出，市場偏向恐懼/超賣，歷史上類似區間常對應較佳的加密貨幣累積時機。`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: loc } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  const isEn = locale === 'en';
  const dip = getDipIndex();
  const v = dip?.value ?? '';
  const desc = dip
    ? (isEn
      ? `The BYDFi Dip Index currently reads ${v} (${dip.label}). An original composite buy-the-dip signal blending Fear & Greed, BTC drawdown, the 200-day MA, RSI, funding rate and news-fear; updated every 2 hours.`
      : `BYDFi 抄底指數目前為 ${v}（${dip.label}）。整合恐懼貪婪指數、BTC 回調、200日均線、RSI、資金費率與新聞恐慌度的原創複合抄底訊號，每 2 小時更新。`)
    : (isEn ? 'BYDFi Dip Index — an original composite buy-the-dip signal for crypto.' : 'BYDFi 抄底指數 — 原創複合加密貨幣抄底訊號。');
  const title = isEn
    ? `BYDFi Dip Index${v !== '' ? ` ${v}` : ''} — Crypto Buy-the-Dip Signal & Sentiment`
    : `BYDFi 抄底指數${v !== '' ? ` ${v}` : ''} — 加密貨幣抄底訊號與市場情緒`;
  return {
    title,
    description: desc,
    alternates: altLanguages('/dip-index', locale),
    openGraph: { title: isEn ? `BYDFi Dip Index ${v}` : `BYDFi 抄底指數 ${v}`, description: desc, url: `${SITE_URL}/${locale}/dip-index`, siteName: SITE_NAME, type: 'website' },
  };
}

export default async function DipIndexPage({ params }: Props) {
  const { locale: loc } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  const isEn = locale === 'en';
  const dip = getDipIndex();
  if (!dip) notFound();

  const history = getDipHistory();
  const prev = history.length >= 2 ? history[history.length - 2].value : null;
  const delta = prev !== null ? dip.value - prev : null;
  const snap = snapshot(dip.value, dip.label, dip.components, locale);
  const losers = getMarkets('cg_losers', 10);
  const dipNews = getDipNews(8);
  const top = getTopIndex();
  const sibling = top ? {
    href: `/${locale}/top-signal`,
    emoji: '🚀',
    title: isEn ? 'BYDFi Top Index' : 'BYDFi 逃頂指數',
    value: top.value,
    label: `${top.label} · ${top.triggered_count}/${top.total} ${isEn ? 'triggered' : '觸發'}`,
    color: topColor(top.value),
    blurb: isEn ? 'The other side of the cycle: let the data tell you when to scale out.' : '市場週期的另一面：何時分批離場，由數據告訴你。',
  } : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset',
        name: 'BYDFi 抄底指數 (BYDFi Dip Index)',
        description: isEn
          ? 'An original composite crypto buy-the-dip signal (0-100) blending market sentiment, BTC drawdown, the 200-day MA, RSI, funding rate and news-fear; updated every 2 hours.'
          : '整合市場情緒、BTC 回調幅度、200日均線、RSI、資金費率與新聞恐慌度的原創複合加密貨幣抄底訊號，0-100，每 2 小時更新。',
        url: `${SITE_URL}/${locale}/dip-index`,
        inLanguage: HTML_LANG[locale],
        creator: { '@type': 'Organization', name: SITE_NAME },
        variableMeasured: dip.components.map((c) => c.name),
        temporalCoverage: history.length ? `${history[0].date}/${history[history.length - 1].date}` : undefined,
        license: `${SITE_URL}/${locale}/dip-index`,
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DipIndexView dip={dip} snapshot={snap} losers={losers} dipNews={dipNews} delta={delta} history={history} sibling={sibling} />
    </>
  );
}
