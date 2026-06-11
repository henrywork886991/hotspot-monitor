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

/* Keyword-rich article URL: /news/<category>/<title-slug>-<id>.
   The trailing id keeps lookups reliable; the slug is the SEO signal. */
export function articlePath(item: { category: string | null; id: number; title?: string | null }): string {
  const cat = item.category ?? 'crypto';
  const seg = item.title ? `${slugify(item.title)}-${item.id}` : String(item.id);
  return `/news/${cat}/${seg}`;
}

/** Parse the numeric id back out of a "slug-123" (or bare "123") path segment. */
export function idFromSlug(seg: string): number {
  const m = seg.match(/(\d+)$/);
  return Number(m ? m[1] : seg);
}

export const CATEGORY_LABELS: Record<string, string> = {
  all: '全部', markets: '行情', crypto: 'Crypto', defi: 'DeFi', web3: 'Web3',
  cn_crypto: '中文幣圈', asia: '亞洲', stocks: '美股', macro: '宏觀',
  regulation: '監管', tech: '科技',
};
export function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c] ?? c;
}

export function coinPath(base: string): string {
  return `/coin/${base.toUpperCase()}`;
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
