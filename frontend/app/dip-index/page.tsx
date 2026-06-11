import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDipIndex, getDipHistory, getTopIndex } from '@/lib/market-extras';
import { getDipNews, getMarkets } from '@/lib/db';
import { SITE_URL, SITE_NAME } from '@/lib/site';
import DipIndexView from '@/components/DipIndexView';

export const dynamic = 'force-dynamic';

const URL = `${SITE_URL}/dip-index`;

// Top index uses the red-high scale (high = overheated = distribution risk).
function topColor(v: number): string {
  if (v >= 75) return 'var(--color-red)';
  if (v >= 60) return '#ff6b3d';
  if (v >= 45) return '#f6a623';
  return 'var(--color-green)';
}

function snapshot(value: number, label: string, comps: { name: string; score: number }[]): string {
  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  const top = [...comps].sort((a, b) => b.score - a.score).slice(0, 3).map((c) => c.name).join('、');
  return `截至 ${today}，BYDFi 抄底指數為 ${value}（${label}）。指數整合鏈上估值（MVRV-Z、NUPL）、技術面（200 日均線、RSI、回調幅度）、市場情緒（恐懼貪婪指數、資金費率）與獨家新聞恐慌度等多維度訊號，目前以 ${top} 等訊號最為突出，市場偏向恐懼/超賣，歷史上類似區間常對應較佳的加密貨幣累積時機。`;
}

export async function generateMetadata(): Promise<Metadata> {
  const dip = getDipIndex();
  const v = dip?.value ?? '';
  const desc = dip
    ? `BYDFi 抄底指數目前為 ${v}（${dip.label}）。整合恐懼貪婪指數、BTC 回調、200日均線、RSI、資金費率與新聞恐慌度的原創複合抄底訊號，每 2 小時更新。`
    : 'BYDFi 抄底指數 — 原創複合加密貨幣抄底訊號。';
  return {
    title: `BYDFi 抄底指數${v !== '' ? ` ${v}` : ''} — 加密貨幣抄底訊號與市場情緒`,
    description: desc,
    alternates: { canonical: URL },
    openGraph: { title: `BYDFi 抄底指數 ${v}`, description: desc, url: URL, siteName: SITE_NAME, type: 'website' },
  };
}

export default async function DipIndexPage() {
  const dip = getDipIndex();
  if (!dip) notFound();

  const history = getDipHistory();
  const prev = history.length >= 2 ? history[history.length - 2].value : null;
  const delta = prev !== null ? dip.value - prev : null;
  const snap = snapshot(dip.value, dip.label, dip.components);
  const losers = getMarkets('cg_losers', 10);
  const dipNews = getDipNews(8);
  const top = getTopIndex();
  const sibling = top ? {
    href: '/top-signal',
    emoji: '🚀',
    title: 'BYDFi 逃頂指數',
    value: top.value,
    label: `${top.label} · ${top.triggered_count}/${top.total} 觸發`,
    color: topColor(top.value),
    blurb: '市場週期的另一面：何時分批離場，由數據告訴你。',
  } : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset',
        name: 'BYDFi 抄底指數 (BYDFi Dip Index)',
        description: '整合市場情緒、BTC 回調幅度、200日均線、RSI、資金費率與新聞恐慌度的原創複合加密貨幣抄底訊號，0-100，每 2 小時更新。',
        url: URL,
        creator: { '@type': 'Organization', name: SITE_NAME },
        variableMeasured: dip.components.map((c) => c.name),
        temporalCoverage: history.length ? `${history[0].date}/${history[history.length - 1].date}` : undefined,
        license: `${SITE_URL}/dip-index`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'News', item: `${SITE_URL}/news` },
          { '@type': 'ListItem', position: 2, name: 'BYDFi 抄底指數' },
        ],
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
