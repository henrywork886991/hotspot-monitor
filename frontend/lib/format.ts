/* Shared date helpers. SQLite stores naive-UTC timestamps ("2026-06-02 02:00:00")
   which JS would otherwise parse as local time — normalize to a real UTC instant. */

export function parseUtc(dateStr: string): number {
  const s = dateStr.trim();
  // RFC 822 ("Wed, 03 Jun 2026 07:43:43 GMT") — JS Date parses these natively.
  if (/^[A-Za-z]{3},/.test(s)) return new Date(s).getTime();
  // SQLite naive-UTC ("2026-06-03 07:43:43") — assume UTC so it isn't read as local.
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s.replace(' ', 'T') + 'Z').getTime();
}

/** Relative time: "now", "25m", "3h", or "Jun 2". */
export function relTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const t = parseUtc(dateStr);
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(t).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

/** Wall-clock "HH:MM" for the live flash feed. */
export function clockTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const t = parseUtc(dateStr);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** USD price with exchange-style precision (decimals scale to magnitude). */
export function fmtUsd(price: number | null | undefined): string {
  if (price == null || Number.isNaN(price)) return '';
  const v = Number(price);
  const dp = v >= 1 ? 2 : v >= 0.01 ? 4 : v >= 0.0001 ? 6 : 8;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

/** Signed 24h percent, e.g. "+2.34%" / "-1.80%". Empty string if unknown. */
export function fmtPct(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return '';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}
