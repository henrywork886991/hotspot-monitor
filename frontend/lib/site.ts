import { type Locale, DEFAULT_LOCALE } from './i18n/config';

/* Canonical base URL — override with NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://news.bydfi.com').replace(/\/$/, '');
export const SITE_NAME = 'BYDFi Crypto News';

/* SEO-friendly slug from a title (kept short; ASCII + CJK preserved). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['"’“”]/g, '')
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'article';
}

/* Keyword-rich article URL: /<locale>/news/<category>/<title-slug>-<id>.
   The trailing id keeps lookups reliable; the slug is the SEO signal. */
export function articlePath(item: { category: string | null; id: number; title?: string | null }, locale: Locale = DEFAULT_LOCALE): string {
  const cat = item.category ?? 'crypto';
  const seg = item.title ? `${slugify(item.title)}-${item.id}` : String(item.id);
  return `/${locale}/news/${cat}/${seg}`;
}

/** Parse the numeric id back out of a "slug-123" (or bare "123") path segment. */
export function idFromSlug(seg: string): number {
  const m = seg.match(/(\d+)$/);
  return Number(m ? m[1] : seg);
}

/* Short labels for the compact tab bar, per locale. */
export const CATEGORY_LABELS: Record<Locale, Record<string, string>> = {
  zh: {
    all: '全部', markets: '行情', crypto: 'Crypto', defi: 'DeFi', web3: 'Web3',
    cn_crypto: '中文幣圈', asia: '亞洲', stocks: '美股', macro: '宏觀',
    regulation: '監管', tech: '科技', altcoin: '山寨幣',
  },
  en: {
    all: 'All', markets: 'Markets', crypto: 'Crypto', defi: 'DeFi', web3: 'Web3',
    cn_crypto: 'CN Crypto', asia: 'Asia', stocks: 'Stocks', macro: 'Macro',
    regulation: 'Regulation', tech: 'Tech', altcoin: 'Altcoin',
  },
};
export function categoryLabel(c: string, locale: Locale = DEFAULT_LOCALE): string {
  return CATEGORY_LABELS[locale][c] ?? CATEGORY_LABELS.zh[c] ?? c;
}

/* Descriptive, SEO-friendly category labels for breadcrumbs / <title> / <h1>.
   Longer forms read better in a breadcrumb trail and for Google. */
export const CATEGORY_FULL_LABELS: Record<Locale, Record<string, string>> = {
  zh: {
    all: '全部', altcoin: '山寨幣', markets: '行情數據', crypto: '加密貨幣',
    defi: 'DeFi 去中心化金融', web3: 'Web3 基礎設施', cn_crypto: '中文幣圈', asia: '亞洲市場',
    stocks: '美股', macro: '宏觀經濟', regulation: '監管合規', tech: '科技 & AI',
  },
  en: {
    all: 'All', altcoin: 'Altcoins', markets: 'Market Data', crypto: 'Crypto',
    defi: 'DeFi', web3: 'Web3', cn_crypto: 'Chinese Crypto', asia: 'Asia Markets',
    stocks: 'US Stocks', macro: 'Macro', regulation: 'Regulation', tech: 'Tech & AI',
  },
};
export function categoryFullLabel(c: string, locale: Locale = DEFAULT_LOCALE): string {
  return CATEGORY_FULL_LABELS[locale][c] ?? CATEGORY_FULL_LABELS.zh[c] ?? CATEGORY_LABELS[locale][c] ?? c;
}

export function coinPath(base: string, locale: Locale = DEFAULT_LOCALE): string {
  return `/${locale}/coin/${base.toUpperCase()}`;
}

export function bydfiSpotUrl(pair: string): string {
  return `https://www.bydfi.com/en/spot/${pair}`;
}

/* Display names for common coins (header/SEO); falls back to the ticker. */
export const COIN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', BNB: 'BNB',
  DOGE: 'Dogecoin', ADA: 'Cardano', AVAX: 'Avalanche', LINK: 'Chainlink',
  DOT: 'Polkadot', MATIC: 'Polygon', POL: 'Polygon', TON: 'Toncoin', TRX: 'TRON',
  SHIB: 'Shiba Inu', PEPE: 'Pepe', WIF: 'dogwifhat', HYPE: 'Hyperliquid',
  PENGU: 'Pudgy Penguins', NEAR: 'NEAR Protocol', SUI: 'Sui', APT: 'Aptos',
  ARB: 'Arbitrum', OP: 'Optimism', LTC: 'Litecoin', BCH: 'Bitcoin Cash',
  UNI: 'Uniswap', AAVE: 'Aave', ENA: 'Ethena', ONDO: 'Ondo', WLD: 'Worldcoin',
  KAS: 'Kaspa', TAO: 'Bittensor', RENDER: 'Render', INJ: 'Injective',
  FIL: 'Filecoin', ATOM: 'Cosmos', XLM: 'Stellar', ETC: 'Ethereum Classic',
  XMR: 'Monero', XAUT: 'Tether Gold', PENDLE: 'Pendle',
};

export function coinName(base: string): string {
  return COIN_NAMES[base.toUpperCase()] ?? base.toUpperCase();
}

/* SQLite "YYYY-MM-DD HH:MM:SS" (UTC) → ISO 8601 for schema/datetime attrs. */
export function toIso(s: string | null): string {
  if (!s) return '';
  const t = s.trim();
  if (/^[A-Za-z]{3},/.test(t)) { const d = new Date(t); return Number.isNaN(+d) ? '' : d.toISOString(); }
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(t);
  const d = new Date(hasTz ? t : t.replace(' ', 'T') + 'Z');
  return Number.isNaN(+d) ? '' : d.toISOString();
}
