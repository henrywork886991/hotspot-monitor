'use client';

import css from 'styled-jsx/css';

interface Pt { date: string; value: number }

const W = 800, H = 220, PAD_L = 28, PAD_R = 14, PAD_T = 14, PAD_B = 22;

function color(v: number): string {
  if (v >= 75) return '#0ecb81';
  if (v >= 60) return '#9acd32';
  if (v >= 45) return '#f6a623';
  return '#f6465d';
}

const styles = css`
  .chart-wrap { width: 100%; }
  .chart-wrap svg { width: 100%; height: auto; display: block; }
  .zlabel { font-size: 10px; fill: var(--spec-font-color-4); }
  .axis { font-size: 11px; fill: var(--spec-font-color-3); }
  .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 10px; font-size: 11px; color: var(--spec-font-color-3); }
  .legend i { display: inline-block; width: 18px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 5px; }
`;

export default function DipChart({ history }: { history: Pt[] }) {
  if (history.length < 2) return null;
  const n = history.length;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD_T + (1 - v / 100) * innerH;

  const linePts = history.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const areaPts = `${PAD_L},${y(0)} ${linePts} ${x(n - 1)},${y(0)}`;
  const last = history[n - 1];
  const lastC = color(last.value);

  const fmt = (d: string) => d.slice(5).replace('-', '/');

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="BYDFi 抄底指數 90 天走勢">
        <defs>
          <linearGradient id="dipArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lastC} stopOpacity="0.28" />
            <stop offset="100%" stopColor={lastC} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* zone gridlines: 抄底 60 / 強烈 75 */}
        {[25, 50, 60, 75].map((g) => (
          <g key={g}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(g)} y2={y(g)}
                  stroke="var(--spec-border-level-2)" strokeWidth="1"
                  strokeDasharray={g === 60 || g === 75 ? '4 4' : undefined} />
            <text className="zlabel" x={4} y={y(g) + 3}>{g}</text>
          </g>
        ))}

        <polygon points={areaPts} fill="url(#dipArea)" />
        <polyline points={linePts} fill="none" stroke={lastC} strokeWidth="2.5"
                  strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(last.value)} r="4" fill={lastC} />

        {/* x-axis: first / mid / last dates */}
        <text className="axis" x={PAD_L} y={H - 6} textAnchor="start">{fmt(history[0].date)}</text>
        <text className="axis" x={PAD_L + innerW / 2} y={H - 6} textAnchor="middle">{fmt(history[Math.floor(n / 2)].date)}</text>
        <text className="axis" x={W - PAD_R} y={H - 6} textAnchor="end">{fmt(last.date)}</text>
      </svg>

      <div className="legend">
        <span><i style={{ background: '#0ecb81' }} />≥75 強烈抄底</span>
        <span><i style={{ background: '#9acd32' }} />60–75 抄底區間</span>
        <span><i style={{ background: '#f6a623' }} />45–60 中性</span>
        <span><i style={{ background: '#f6465d' }} />&lt;45 偏熱/貪婪</span>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}
