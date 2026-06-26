import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTopIndex, getTopHistory, getDipIndex } from '@/lib/market-extras';
import { getTopNews, getMarkets } from '@/lib/db';
import { SITE_URL, SITE_NAME } from '@/lib/site';
import { isLocale, HTML_LANG, INTL_LOCALE, type Locale } from '@/lib/i18n/config';
import { altLanguages } from '@/lib/i18n/seo';
import TopSignalView from '@/components/TopSignalView';

// Dip index uses the green-high scale (high = fear/oversold = good accumulation).
function dipColor(v: number): string {
  if (v >= 75) return 'var(--color-green)';
  if (v >= 60) return '#9acd32';
  if (v >= 45) return '#f6a623';
  return 'var(--color-red)';
}

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function snapshot(value: number, label: string, fired: number, total: number, sigs: { name: string; triggered: boolean; heat: number }[], locale: Locale): string {
  const today = new Date().toLocaleDateString(INTL_LOCALE[locale], { year: 'numeric', month: 'long', day: 'numeric' });
  const sep = locale === 'en' ? ', ' : '、';
  const hottest = [...sigs].sort((a, b) => b.heat - a.heat).slice(0, 3).map((s) => s.name).join(sep);
  const firedNames = sigs.filter((s) => s.triggered).map((s) => s.name).join(sep);
  if (locale === 'en') {
    const tail = fired > 0
      ? `${fired}/${total} top signals have triggered (${firedNames}); watch for staged profit-taking.`
      : `All ${total} top signals are untriggered (${fired}/${total}); the market is not yet overheated, with ${hottest} closest to threshold.`;
    return `As of ${today}, the BYDFi Top Index reads ${value} (${label}). It blends on-chain valuation (MVRV-Z, NUPL, Puell), cycle models (Pi Cycle, Mayer Multiple), sentiment, derivatives funding and an exclusive news-euphoria gauge. ${tail}`;
  }
  const tail = fired > 0
    ? `目前已觸發 ${fired}/${total} 項頂部訊號（${firedNames}），需留意分批獲利了結的時機。`
    : `目前 ${total} 項頂部訊號均未觸發（${fired}/${total}），市場尚未進入過熱區，其中以 ${hottest} 最接近閾值。`;
  return `截至 ${today}，BYDFi 逃頂指數為 ${value}（${label}）。指數整合鏈上估值（MVRV-Z、NUPL、Puell）、週期模型（Pi Cycle、Mayer Multiple）、市場情緒、衍生品資金費率與獨家新聞狂熱度等頂部訊號。${tail}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: loc } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  const isEn = locale === 'en';
  const top = getTopIndex();
  const v = top?.value ?? '';
  const desc = top
    ? (isEn
      ? `The BYDFi Top Index currently reads ${v} (${top.label}), with ${top.triggered_count}/${top.total} top signals triggered. An original composite top signal blending MVRV-Z, Pi Cycle, Mayer Multiple, NUPL, Puell, funding rate and news-euphoria; updated every 2 hours.`
      : `BYDFi 逃頂指數目前為 ${v}（${top.label}），${top.triggered_count}/${top.total} 項頂部訊號觸發。整合 MVRV-Z、Pi Cycle、Mayer Multiple、NUPL、Puell、資金費率與新聞狂熱度的原創複合逃頂訊號，每 2 小時更新。`)
    : (isEn ? 'BYDFi Top Index — an original composite crypto cycle-top signal.' : 'BYDFi 逃頂指數 — 原創複合加密貨幣逃頂訊號。');
  const title = isEn
    ? `BYDFi Top Index${v !== '' ? ` ${v}` : ''} — Bitcoin Cycle-Top Signals`
    : `BYDFi 逃頂指數${v !== '' ? ` ${v}` : ''} — 比特幣頂部信號與逃頂指標`;
  return {
    title,
    description: desc,
    alternates: altLanguages('/top-signal', locale),
    openGraph: { title: isEn ? `BYDFi Top Index ${v}` : `BYDFi 逃頂指數 ${v}`, description: desc, url: `${SITE_URL}/${locale}/top-signal`, siteName: SITE_NAME, type: 'website' },
  };
}

export default async function TopSignalPage({ params }: Props) {
  const { locale: loc } = await params;
  const locale = isLocale(loc) ? loc : 'zh';
  const isEn = locale === 'en';
  const top = getTopIndex();
  if (!top) notFound();

  const history = getTopHistory();
  const prev = history.length >= 2 ? history[history.length - 2].value : null;
  const delta = prev !== null ? top.value - prev : null;
  const snap = snapshot(top.value, top.label, top.triggered_count, top.total, top.signals, locale);
  const gainers = getMarkets('cg_gainers', 10);
  const topNews = getTopNews(8);
  const dip = getDipIndex();
  const sibling = dip ? {
    href: `/${locale}/dip-index`,
    emoji: '🩸',
    title: isEn ? 'BYDFi Dip Index' : 'BYDFi 抄底指數',
    value: dip.value,
    label: dip.label,
    color: dipColor(dip.value),
    blurb: isEn ? 'The other side of the cycle: let the data tell you when to accumulate.' : '市場週期的另一面：何時進場累積，由數據告訴你。',
  } : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset',
        name: 'BYDFi 逃頂指數 (BYDFi Top Signal)',
        description: isEn
          ? 'An original composite crypto cycle-top signal (0-100) blending MVRV-Z, Pi Cycle, Mayer Multiple, NUPL, Puell, Fear & Greed, funding rate, BTC dominance and news-euphoria, with a triggered-signal checklist; updated every 2 hours.'
          : '整合 MVRV-Z、Pi Cycle、Mayer Multiple、NUPL、Puell、恐懼貪婪指數、資金費率、BTC 占有率與新聞狂熱度的原創複合加密貨幣逃頂訊號，0-100，附 N 項頂部訊號觸發清單，每 2 小時更新。',
        url: `${SITE_URL}/${locale}/top-signal`,
        inLanguage: HTML_LANG[locale],
        creator: { '@type': 'Organization', name: SITE_NAME },
        variableMeasured: top.signals.map((s) => s.name),
        temporalCoverage: history.length ? `${history[0].date}/${history[history.length - 1].date}` : undefined,
        license: `${SITE_URL}/${locale}/top-signal`,
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TopSignalView top={top} snapshot={snap} gainers={gainers} topNews={topNews} delta={delta} history={history} sibling={sibling} />
    </>
  );
}
