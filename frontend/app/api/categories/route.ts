import { NextResponse } from 'next/server';
import { queryCategories } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  all:        { label: '全部',     icon: '🌐' },
  crypto:     { label: 'Crypto',   icon: '₿'  },
  defi:       { label: 'DeFi',     icon: '🔗' },
  web3:       { label: 'Web3',     icon: '🌐' },
  cn_crypto:  { label: '中文幣圈', icon: '🇨🇳' },
  asia:       { label: '亞洲',     icon: '🌏' },
  stocks:     { label: '美股',     icon: '📈' },
  macro:      { label: '宏觀',     icon: '🏦' },
  regulation: { label: '監管',     icon: '⚖️' },
  tech:       { label: '科技',     icon: '💻' },
};

export async function GET() {
  const rows = queryCategories();

  const categories = rows.map((r) => ({
    key: r.key,
    label: CATEGORY_META[r.key]?.label ?? r.key,
    icon: CATEGORY_META[r.key]?.icon ?? '•',
    count: r.count,
  }));

  // Ensure 'all' is first
  categories.sort((a, b) => (a.key === 'all' ? -1 : b.key === 'all' ? 1 : 0));

  return NextResponse.json({ categories });
}
