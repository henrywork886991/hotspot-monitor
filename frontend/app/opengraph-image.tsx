import { ImageResponse } from 'next/og';

// Site-wide default OG image. Next applies this to any route that doesn't define
// its own opengraph-image and doesn't set openGraph.images explicitly — so every
// page (home, category, and articles without a cover) gets a branded share card.
// ASCII-only by design: no CJK webfont to bundle, renders cleanly everywhere.

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'BYDFi Crypto News';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '90px',
          background: 'linear-gradient(135deg, #0b0e11 0%, #15171c 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', width: 88, height: 8, background: '#ffd30f', borderRadius: 4, marginBottom: 40 }} />
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, color: '#ffffff', letterSpacing: -2 }}>
          BYDFi <span style={{ color: '#ffd30f', marginLeft: 18 }}>Crypto News</span>
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#aeb4bf', marginTop: 28, maxWidth: 900 }}>
          Real-time crypto, DeFi & market hotspots — news, coin analysis and prices.
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#6b7280', marginTop: 'auto' }}>
          news.bydfi.com
        </div>
      </div>
    ),
    { ...size },
  );
}
