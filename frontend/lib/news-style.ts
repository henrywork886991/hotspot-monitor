/* Shared visual tokens for news components (cards, hero, sidebar). */

export const SOURCE_COLORS: Record<string, string> = {
  coindesk:      '#4a9eff',
  cointelegraph: '#e95d2a',
  decrypt:       '#9b59b6',
  thedefiant:    '#00c5b3',
  beincrypto:    '#1e88e5',
  techcrunch:    '#0a9e30',
  hackernews:    '#ff6600',
  coingecko:     '#8dc647',
  panews:        '#ffd30f',
  odaily:        '#3b82f6',
  blocktempo:    '#8b5cf6',
  sopilot:       '#06b6d4',
  wsj:           '#e04e2a',
  yahoo:         '#7b68ee',
  cnbc:          '#cc0000',
  ft:            '#f98500',
  fxstreet:      '#1565c0',
  forexlive:     '#0288d1',
};

export const IMPORTANCE_CONFIG = {
  urgent: { label: '緊急', color: 'var(--color-red)',            bg: 'rgba(246,70,93,0.12)'  },
  high:   { label: '重要', color: '#f0b90b',                     bg: 'rgba(240,185,11,0.12)' },
  medium: { label: '一般', color: 'var(--spec-font-color-2)',    bg: 'var(--spec-background-color-4)' },
  low:    { label: '快訊', color: 'var(--spec-font-color-3)',    bg: 'var(--spec-background-color-4)' },
} as const;

/* Category gradient backgrounds — used as image fallbacks. */
export const CATEGORY_BG: Record<string, string> = {
  crypto:     'linear-gradient(145deg, #131a2e 0%, #0c0d0e 100%)',
  defi:       'linear-gradient(145deg, #101e2a 0%, #0c0d0e 100%)',
  stocks:     'linear-gradient(145deg, #131e13 0%, #0c0d0e 100%)',
  macro:      'linear-gradient(145deg, #1a1513 0%, #0c0d0e 100%)',
  tech:       'linear-gradient(145deg, #16112a 0%, #0c0d0e 100%)',
  regulation: 'linear-gradient(145deg, #1e1510 0%, #0c0d0e 100%)',
  cn_crypto:  'linear-gradient(145deg, #1e1505 0%, #0c0d0e 100%)',
  asia:       'linear-gradient(145deg, #1a1025 0%, #0c0d0e 100%)',
  web3:       'linear-gradient(145deg, #0f1a25 0%, #0c0d0e 100%)',
  all:        'linear-gradient(145deg, #15181d 0%, #0c0d0e 100%)',
};

// Stable hue from a string — gives every unmapped source a distinct, consistent
// colour instead of all collapsing to the same grey. Tuned for dark backgrounds.
function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function sourceColor(source: string): string {
  const key = source.toLowerCase().replace(/[^a-z]/g, '');
  if (SOURCE_COLORS[key]) return SOURCE_COLORS[key];
  // Branded sources often carry suffixes (odaily_flash, panews_rss, yahoo_finance)
  // — match the known brand prefix so variants share one colour.
  for (const brand in SOURCE_COLORS) {
    if (key.startsWith(brand)) return SOURCE_COLORS[brand];
  }
  return `hsl(${hashHue(key)}, 62%, 62%)`;
}
