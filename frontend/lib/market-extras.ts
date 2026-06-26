import path from 'path';
import fs from 'fs';

export interface FearGreed {
  value: number;
  classification: string;
  label_zh: string;
  prev: number;
  delta: number;
  updated: string;
}

const FG_PATH = path.resolve(process.cwd(), '..', 'data', 'fear_greed.json');

/** Read the cached Crypto Fear & Greed Index (written by fetch_fear_greed.py). */
export function getFearGreed(): FearGreed | null {
  try {
    return JSON.parse(fs.readFileSync(FG_PATH, 'utf-8')) as FearGreed;
  } catch {
    return null;
  }
}

export interface DipComponent { name: string; desc: string; weight: number; score: number }
export interface DipIndex {
  value: number;
  label: string;
  slug: string;
  components: DipComponent[];
  news_meta: { fear_headlines: number; total_headlines: number };
  updated: string;
}

const DIP_PATH = path.resolve(process.cwd(), '..', 'data', 'dip_index.json');
const DIP_HIST_PATH = path.resolve(process.cwd(), '..', 'data', 'dip_index_history.json');

/** The BYDFi 抄底指數 (our composite dip signal). null if not computed yet. */
export function getDipIndex(): DipIndex | null {
  try {
    return JSON.parse(fs.readFileSync(DIP_PATH, 'utf-8')) as DipIndex;
  } catch {
    return null;
  }
}

/** Daily history of the dip index for the trend sparkline. */
export function getDipHistory(): Array<{ date: string; value: number }> {
  try {
    return JSON.parse(fs.readFileSync(DIP_HIST_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

export interface TopSignal {
  key: string;
  name: string;
  category: string;
  weight: number;
  heat: number;
  value: string;
  threshold: string;
  triggered: boolean;
  detail: string;
}
export interface TopIndex {
  value: number;
  label: string;
  slug: string;
  triggered_count: number;
  total: number;
  signals: TopSignal[];
  news_meta: { hot_headlines: number; total_headlines: number };
  btc_price: number | null;
  updated: string;
}

const TOP_PATH = path.resolve(process.cwd(), '..', 'data', 'top_index.json');
const TOP_HIST_PATH = path.resolve(process.cwd(), '..', 'data', 'top_index_history.json');

/** The BYDFi 逃頂指數 (our composite top/distribution signal). null if not computed yet. */
export function getTopIndex(): TopIndex | null {
  try {
    return JSON.parse(fs.readFileSync(TOP_PATH, 'utf-8')) as TopIndex;
  } catch {
    return null;
  }
}

/** Daily history of the top index for the trend sparkline. */
export function getTopHistory(): Array<{ date: string; value: number }> {
  try {
    return JSON.parse(fs.readFileSync(TOP_HIST_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

export interface CoinPrice {
  price: number;
  pct24h: number | null;
  name: string;
  rank: number | null;
}

const PRICES_PATH = path.resolve(process.cwd(), '..', 'data', 'coin_prices.json');

/* Read fresh each call — the file is rewritten by fetch_coin_prices.py on every
   refresh, and the coin/category pages are force-dynamic, so no stale cache. */
function loadPrices(): Record<string, CoinPrice> {
  try {
    const raw = JSON.parse(fs.readFileSync(PRICES_PATH, 'utf-8')) as Record<string, unknown>;
    delete raw._updated;
    return raw as Record<string, CoinPrice>;
  } catch {
    return {};
  }
}

/** Current price + 24h change for one coin (by base ticker). null if unknown. */
export function getCoinPrice(base: string): CoinPrice | null {
  return loadPrices()[base.toUpperCase()] ?? null;
}

/** Price map for several coins at once (article token chips). */
export function getCoinPrices(bases: string[]): Record<string, CoinPrice> {
  const all = loadPrices();
  const out: Record<string, CoinPrice> = {};
  for (const b of bases) {
    const hit = all[b.toUpperCase()];
    if (hit) out[b.toUpperCase()] = hit;
  }
  return out;
}
