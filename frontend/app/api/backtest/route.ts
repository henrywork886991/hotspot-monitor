import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// "少虧多少 / 多賺多少" backtest: given a historical exit/entry date and a USD
// amount, compare against holding/buying BTC until today.
// Historical price comes from a baked static daily-close history (Binance, full
// 2017→now) — CoinGecko's free API only serves the last 365 days, which would
// break all the famous-top quick-picks. Live CoinGecko is only a fallback for
// very recent dates not yet in the static file. /simple/price gives "now".

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };

const BTC_DAILY_PATH = path.resolve(process.cwd(), '..', 'data', 'btc_daily.json');
let _daily: Record<string, number> | null = null;
function dailyMap(): Record<string, number> {
  if (_daily) return _daily;
  try {
    _daily = JSON.parse(fs.readFileSync(BTC_DAILY_PATH, 'utf-8')) as Record<string, number>;
  } catch {
    _daily = {};
  }
  return _daily;
}

async function priceOn(date: string): Promise<number | null> {
  const staticClose = dailyMap()[date];
  if (typeof staticClose === 'number') return staticClose;
  // Fallback: live CoinGecko (only works within the past 365 days). Wants DD-MM-YYYY.
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return null;
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${d}-${m}-${y}&localization=false`,
      { headers: UA, next: { revalidate: 86400 } },
    );
    const j = await r.json();
    return j?.market_data?.current_price?.usd ?? null;
  } catch {
    return null;
  }
}

async function priceNow(): Promise<number | null> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      { headers: UA, next: { revalidate: 600 } },
    );
    const j = await r.json();
    return j?.bitcoin?.usd ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = (searchParams.get('date') || '').trim();
  const amount = Math.max(0, parseFloat(searchParams.get('amount') || '0'));
  const mode = searchParams.get('mode') === 'dip' ? 'dip' : 'top';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !amount) {
    return NextResponse.json({ error: 'bad params' }, { status: 400 });
  }
  if (new Date(date).getTime() > Date.now()) {
    return NextResponse.json({ error: 'future date' }, { status: 400 });
  }

  const [pThen, pNow] = await Promise.all([priceOn(date), priceNow()]);
  if (!pThen || !pNow) {
    return NextResponse.json({ error: 'price unavailable' }, { status: 502 });
  }

  const btc = amount / pThen;            // BTC the amount bought at the date
  const valueNow = btc * pNow;           // worth today if held
  // top mode: you EXITED at the date → "saved" = amount you held minus today's value.
  // dip mode: you BOUGHT at the date → "gained" = today's value minus cost.
  const diff = mode === 'top' ? amount - valueNow : valueNow - amount;
  const pct = mode === 'top' ? (amount - valueNow) / amount * 100 : (valueNow - amount) / amount * 100;

  return NextResponse.json({
    mode, date, amount,
    priceThen: pThen,
    priceNow: pNow,
    btc,
    valueNow,
    diff,             // positive = the signal would have helped
    pct,
  });
}
