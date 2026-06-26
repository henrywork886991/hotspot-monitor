import { ImageResponse } from 'next/og';
import { getCoinPrice } from '@/lib/market-extras';
import { coinName } from '@/lib/site';
import { fmtUsd, fmtPct } from '@/lib/format';

// Per-coin OG share card: ticker + live price + 24h change + brand. ASCII-only
// (coin names in COIN_NAMES are English), so no CJK font needed.

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Coin news on BYDFi Crypto News';

function clean(sym: string): string {
  return sym.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const base = clean(symbol);
  const name = coinName(base);
  const price = getCoinPrice(base);
  const up = (price?.pct24h ?? 0) >= 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '80px 90px',
          background: 'linear-gradient(135deg, #0b0e11 0%, #15171c 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 120, height: 120, borderRadius: 28, background: '#ffd30f',
              fontSize: 44, fontWeight: 900, color: '#0b0e11',
            }}
          >
            {base.slice(0, 4)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: '#ffffff' }}>{name}</div>
            <div style={{ display: 'flex', fontSize: 30, color: '#aeb4bf', marginTop: 6 }}>{base} · Latest news & analysis</div>
          </div>
        </div>

        {price ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
            <div style={{ display: 'flex', fontSize: 88, fontWeight: 800, color: '#ffffff' }}>{fmtUsd(price.price)}</div>
            {price.pct24h !== null && (
              <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: up ? '#0ecb81' : '#f6465d' }}>
                {fmtPct(price.pct24h)} (24h)
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 44, color: '#aeb4bf' }}>News, market moves & analysis</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, color: '#ffffff' }}>
            BYDFi <span style={{ color: '#ffd30f', marginLeft: 12 }}>Crypto News</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: '#0b0e11', background: '#ffd30f', padding: '12px 24px', borderRadius: 12 }}>
            Trade {base} on BYDFi
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
