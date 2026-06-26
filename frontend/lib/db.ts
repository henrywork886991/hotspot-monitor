import path from 'path';
import { NewsItem, Category } from '@/types';

// DB path: project root is two levels up from frontend/
const DB_PATH = path.resolve(process.cwd(), '..', 'data', 'hotspots.db');

function getDb() {
  // Dynamic import to avoid issues with Next.js edge runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  return new Database(DB_PATH, { readonly: true });
}

// Coins treated as "major" — excluded from the 山寨幣 (altcoin) feed. Covers the
// dedicated coin tabs plus BNB and the stablecoins (which are quote, not altcoins).
const ALTCOIN_MAJORS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'TRX', 'DOGE', 'ADA', 'USDT', 'USDC'];

export interface QueryOptions {
  category?: Category | 'all';
  importance?: string;
  keyword?: string;
  page?: number;
  limit?: number;
  hours?: number;
  /** Grid gate: only "complete" articles — AI-rewritten AND with a real image. */
  readyOnly?: boolean;
}

export function queryNews(opts: QueryOptions = {}): { items: NewsItem[]; total: number } {
  const { category, importance, keyword, page = 1, limit = 20, hours = 72, readyOnly = false } = opts;

  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    // DB not found — return empty
    return { items: [], total: 0 };
  }

  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const conditions: string[] = ['fetched_at >= ?'];
  const params: (string | number)[] = [cutoff];

  if (category === 'altcoin') {
    // 山寨幣 (Altcoin): coin-tagged crypto news that mentions NO major coin —
    // i.e. everything outside BTC/ETH and the other large caps (which already
    // have their own tabs). Matches MEXC's "major coins vs. altcoin" framing.
    conditions.push("category IN ('crypto','cn_crypto','defi','web3')");
    conditions.push("symbols IS NOT NULL AND symbols != ''");
    for (const m of ALTCOIN_MAJORS) {
      conditions.push("(',' || symbols) NOT LIKE ? ESCAPE '\\'");
      params.push(`%,${m}\\_%`);
    }
  } else if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  } else {
    // "All" is the news flow — keep price-data (markets) out of it
    conditions.push("(category IS NULL OR category != 'markets')");
  }
  if (importance && importance !== 'all') {
    conditions.push('importance = ?');
    params.push(importance);
  }
  if (keyword) {
    conditions.push('(title LIKE ? OR summary LIKE ? OR keywords LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  // Twitter-handle "news" (title is just the @handle) is low quality — keep it out.
  conditions.push("source != 'sopilot_twitter'");
  // Publishing gate for the main grid: a card only appears once it's "complete" —
  // AI-rewritten (article_md) AND carrying a real cover image (og or generated).
  // Thin/headline-only items (never rewritten) stay in the 24/7 flash list only.
  if (readyOnly) {
    conditions.push("article_md IS NOT NULL AND article_md != ''");
    conditions.push("image_url IS NOT NULL AND image_url != ''");
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Dedup by title (same story from multiple sources) — count distinct titles.
  const total: number = (
    db.prepare(`SELECT COUNT(DISTINCT title) as cnt FROM hotspots ${where}`).get(...params) as { cnt: number }
  ).cnt;

  const offset = (page - 1) * limit;
  // Newest *published* first; one card per title (newest wins). Items with a real
  // publish date lead; the few undated sources follow, ordered by fetch time.
  const order = `(published_at IS NOT NULL AND published_at != '') DESC, published_at DESC, fetched_at DESC`;
  const items = db
    .prepare(
      `WITH ranked AS (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY title ORDER BY ${order}, id DESC) AS rn
         FROM hotspots ${where}
       )
       SELECT * FROM ranked WHERE rn = 1
       ORDER BY ${order}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as NewsItem[];

  db.close();
  return { items, total };
}

// 24/7 快訊: the raw live stream for the sidebar — newest first, NOT gated by the
// grid's "complete" rule, so thin/headline-only items still surface here.
export function getFlash(limit = 30): NewsItem[] {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return [];
  }
  const cutoff = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const order = `(published_at IS NOT NULL AND published_at != '') DESC, published_at DESC, fetched_at DESC`;
  const items = db
    .prepare(
      `WITH ranked AS (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY title ORDER BY ${order}, id DESC) AS rn
         FROM hotspots
         WHERE fetched_at >= ?
           AND (category IS NULL OR category != 'markets')
           AND source != 'sopilot_twitter'
       )
       SELECT * FROM ranked WHERE rn = 1
       ORDER BY ${order}
       LIMIT ?`
    )
    .all(cutoff, limit) as NewsItem[];
  db.close();
  return items;
}

export function queryCategories(): Array<{ key: string; count: number }> {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return [];
  }

  const rows = db
    .prepare(
      `SELECT category as key, COUNT(*) as count
       FROM hotspots
       WHERE fetched_at >= datetime('now', '-72 hours')
       GROUP BY category
       ORDER BY count DESC`
    )
    .all() as Array<{ key: string; count: number }>;

  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM hotspots WHERE fetched_at >= datetime('now', '-72 hours')`).get() as { cnt: number }
  ).cnt;

  db.close();
  return [{ key: 'all', count: total }, ...rows];
}

/** A single article by id (for the detail page). null if missing. */
export function getNewsById(id: number): NewsItem | null {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return null;
  }
  const row = db.prepare(`SELECT * FROM hotspots WHERE id = ?`).get(id) as NewsItem | undefined;
  db.close();
  return row ?? null;
}

/** A few recent same-category articles (excluding the current one) for "related". */
export function getRelated(category: string, excludeId: number, limit = 6): NewsItem[] {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return [];
  }
  const rows = db
    .prepare(
      `SELECT * FROM hotspots
       WHERE category = ? AND id != ? AND category != 'markets'
       ORDER BY COALESCE(NULLIF(published_at, ''), fetched_at) DESC
       LIMIT ?`
    )
    .all(category, excludeId, limit) as NewsItem[];
  db.close();
  return rows;
}

/** Articles that mention a given coin (matched against the `symbols` trade-pair list). */
export function getNewsByCoin(base: string, limit = 40): { items: NewsItem[]; pair: string | null } {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return { items: [], pair: null };
  }
  const b = base.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Match the pair prefix "BASE_" at the start of the list or after a comma.
  const like = `%,${b}\\_%`;
  const items = db
    .prepare(
      `SELECT * FROM hotspots
       WHERE symbols IS NOT NULL AND symbols != ''
         AND (',' || symbols) LIKE ? ESCAPE '\\'
       ORDER BY COALESCE(NULLIF(published_at, ''), fetched_at) DESC
       LIMIT ?`
    )
    .all(like, limit) as NewsItem[];
  // Resolve the actual pair (e.g. BTC_USDT) from the first match.
  let pair: string | null = null;
  for (const it of items) {
    const m = (it.symbols || '').split(',').find((p) => p.trim().toUpperCase().startsWith(`${b}_`));
    if (m) { pair = m.trim(); break; }
  }
  db.close();
  return { items, pair };
}

/** Market rows by source (e.g. 'cg_losers' for the 抄底幣種榜). */
export function getMarkets(source: string, limit = 12): NewsItem[] {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return [];
  }
  const rows = db
    .prepare(`SELECT * FROM hotspots WHERE category='markets' AND source=? ORDER BY id ASC LIMIT ?`)
    .all(source, limit) as NewsItem[];
  db.close();
  return rows;
}

/** Dip-related news: crashes, capitulation, accumulation, "buy the dip", oversold. */
export function getDipNews(limit = 12): NewsItem[] {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return [];
  }
  const terms = [
    'crash', 'plunge', 'selloff', 'sell-off', 'sell off', 'capitulat', 'liquidat',
    'oversold', 'buy the dip', 'dip', 'accumulat', 'bottom', 'tumble', 'slump',
    '暴跌', '崩盤', '崩盘', '抄底', '拋售', '抛售', '清算', '超賣', '增持', '逢低',
  ];
  const likeClause = terms.map(() => '(title LIKE ? OR summary LIKE ? OR keywords LIKE ?)').join(' OR ');
  const params: string[] = [];
  for (const t of terms) params.push(`%${t}%`, `%${t}%`, `%${t}%`);
  const rows = db
    .prepare(
      `SELECT * FROM hotspots
       WHERE category IN ('crypto','cn_crypto','defi','macro') AND source != 'sopilot_twitter'
         AND fetched_at >= datetime('now','-72 hours')
         AND (${likeClause})
       GROUP BY title
       ORDER BY COALESCE(NULLIF(published_at,''), fetched_at) DESC
       LIMIT ?`
    )
    .all(...params, limit) as NewsItem[];
  db.close();
  return rows;
}

/** News for the 逃頂指數 page — euphoria / ATH / overheated headlines. */
export function getTopNews(limit = 12): NewsItem[] {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return [];
  }
  const terms = [
    'all-time high', 'all time high', 'record high', 'new high', 'ATH', 'parabolic',
    'overheat', 'euphoria', 'FOMO', 'surge', 'soar', 'rally', 'overbought', 'take profit',
    '新高', '歷史新高', '历史新高', '狂歡', '狂欢', '暴漲', '暴涨', '飆漲', '飙涨',
    '衝破', '冲破', '過熱', '过热', '獲利了結', '获利了结', '逃頂', '逃顶',
  ];
  const likeClause = terms.map(() => '(title LIKE ? OR summary LIKE ? OR keywords LIKE ?)').join(' OR ');
  const params: string[] = [];
  for (const t of terms) params.push(`%${t}%`, `%${t}%`, `%${t}%`);
  const rows = db
    .prepare(
      `SELECT * FROM hotspots
       WHERE category IN ('crypto','cn_crypto','defi','macro') AND source != 'sopilot_twitter'
         AND fetched_at >= datetime('now','-72 hours')
         AND (${likeClause})
       GROUP BY title
       ORDER BY COALESCE(NULLIF(published_at,''), fetched_at) DESC
       LIMIT ?`
    )
    .all(...params, limit) as NewsItem[];
  db.close();
  return rows;
}

/** Top coins by article mentions in the live window (for badges / hot list / sitemap).
 *  With `altcoinOnly`, the majors are dropped so the 山寨幣 page shows only altcoins. */
export function getHotCoins(limit = 60, opts: { altcoinOnly?: boolean } = {}): Array<{ base: string; pair: string; count: number }> {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return [];
  }
  const rows = db
    .prepare(
      `SELECT symbols FROM hotspots
       WHERE symbols IS NOT NULL AND symbols != ''
         AND fetched_at >= datetime('now', '-72 hours')`
    )
    .all() as Array<{ symbols: string }>;
  db.close();

  // Stablecoins are quote currencies, not meaningful "hot coins".
  const STABLE = new Set(['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDE', 'BUSD', 'USD']);
  // On the 山寨幣 page, also drop the majors so only altcoins remain.
  const exclude = opts.altcoinOnly ? new Set([...STABLE, ...ALTCOIN_MAJORS]) : STABLE;
  const counts = new Map<string, { pair: string; count: number }>();
  for (const r of rows) {
    for (const pair of r.symbols.split(',')) {
      const p = pair.trim();
      if (!p) continue;
      const base = p.split('_')[0].toUpperCase();
      if (exclude.has(base)) continue;
      const cur = counts.get(base);
      if (cur) cur.count += 1;
      else counts.set(base, { pair: p, count: 1 });
    }
  }
  return [...counts.entries()]
    .map(([base, v]) => ({ base, pair: v.pair, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Recent article ids+slugs for the sitemap (news only, within the live window). */
export function getSitemapEntries(limit = 1000): Array<{ id: number; category: string; title: string; published_at: string; fetched_at: string }> {
  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    return [];
  }
  const rows = db
    .prepare(
      `SELECT id, category, title, published_at, fetched_at FROM hotspots
       WHERE category != 'markets' AND fetched_at >= datetime('now', '-72 hours')
       ORDER BY COALESCE(NULLIF(published_at, ''), fetched_at) DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ id: number; category: string; title: string; published_at: string; fetched_at: string }>;
  db.close();
  return rows;
}
