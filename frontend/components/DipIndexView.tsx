'use client';

import Link from 'next/link';
import { NewsItem } from '@/types';
import { DipIndex } from '@/lib/market-extras';
import NewsCard from './NewsCard';
import DipChart from './DipChart';
import BacktestTool from './BacktestTool';
import CycleCrossLink from './CycleCrossLink';
import type { CrossLink } from './TopSignalView';
import css from 'styled-jsx/css';

function zoneColor(v: number): string {
  if (v >= 75) return 'var(--color-green)';
  if (v >= 60) return '#9acd32';
  if (v >= 45) return '#f6a623';
  if (v >= 30) return '#f6a623';
  return 'var(--color-red)';
}

function parse(content: string | null): { price: string; chg: number | null } {
  const p = content?.match(/Price:\s*([^|]+)/);
  const c = content?.match(/24h:\s*(-?\d+(?:\.\d+)?)%/);
  return { price: p ? p[1].trim() : '', chg: c ? parseFloat(c[1]) : null };
}

const styles = css`
  .wrap { max-width: var(--const-max-page-width); margin: 0 auto; padding: 28px 32px 56px; }
  .crumbs { font-size: 13px; color: var(--spec-font-color-3); margin-bottom: 18px; }
  :global(.crumbs a:hover) { color: var(--skin-primary-color); }

  .hero {
    display: grid; grid-template-columns: 220px 1fr; gap: 28px; align-items: center;
    padding: 28px; border-radius: 16px; margin-bottom: 14px;
    background: radial-gradient(120% 140% at 0% 0%, rgba(255,211,15,0.10) 0%, rgba(255,211,15,0) 55%), var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
  }
  .gauge { position: relative; width: 200px; height: 200px; margin: 0 auto; }
  .gauge::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%;
    background: conic-gradient(var(--c) calc(var(--p) * 1%), var(--spec-background-color-4) 0);
    -webkit-mask: radial-gradient(closest-side, transparent 68%, #000 70%);
    mask: radial-gradient(closest-side, transparent 68%, #000 70%);
  }
  .gauge .inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .gauge .v { font-size: 56px; font-weight: 900; line-height: 1; color: var(--c); }
  .gauge .l { font-size: 16px; font-weight: 800; margin-top: 6px; color: var(--c); }
  .gauge .s { font-size: 11px; color: var(--spec-font-color-3); margin-top: 2px; }
  h1.t { font-size: 26px; font-weight: 900; color: var(--spec-font-color-1); margin-bottom: 10px; }
  .snap { font-size: 15px; line-height: 1.8; color: var(--spec-font-color-2); }
  .updated { font-size: 12px; color: var(--spec-font-color-4); margin-top: 12px; }

  .panel { background: var(--spec-background-color-3); border: 1px solid var(--spec-border-level-2); border-radius: 14px; padding: 20px 22px; margin-top: 18px; }
  .panel h2 { font-size: 16px; font-weight: 800; color: var(--spec-font-color-1); margin-bottom: 4px; }
  .panel .sub { font-size: 12px; color: var(--spec-font-color-3); margin-bottom: 16px; }

  /* Scorecard */
  .comp { display: flex; align-items: center; gap: 14px; padding: 11px 0; border-bottom: 1px solid var(--spec-border-level-1); }
  .comp:last-child { border-bottom: none; }
  .comp-name { width: 92px; flex-shrink: 0; font-size: 13px; font-weight: 700; color: var(--spec-font-color-1); }
  .comp-desc { flex: 1; min-width: 0; font-size: 12px; color: var(--spec-font-color-3); }
  .comp-bar { width: 130px; height: 8px; border-radius: 4px; background: var(--spec-background-color-4); overflow: hidden; flex-shrink: 0; }
  .comp-bar > i { display: block; height: 100%; border-radius: 4px; }
  .comp-score { width: 56px; text-align: right; flex-shrink: 0; font-size: 13px; font-weight: 800; color: var(--spec-font-color-1); }
  .comp-score .w { font-size: 10px; color: var(--spec-font-color-4); font-weight: 500; }

  /* 抄底幣種榜 */
  .losers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 24px; }
  :global(.loser-row) { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--spec-border-level-1); }
  :global(.loser-row:hover) .loser-name { color: var(--skin-primary-color); }
  .loser-rank { font-size: 11px; color: var(--spec-font-color-4); width: 16px; }
  .loser-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--spec-font-color-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loser-price { font-size: 12px; color: var(--spec-font-color-2); }
  .loser-chg { font-size: 12px; font-weight: 700; color: var(--color-red); width: 64px; text-align: right; }

  .news-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .method { font-size: 13px; line-height: 1.9; color: var(--spec-font-color-2); }
  .method b { color: var(--spec-font-color-1); }
  .disclaimer { font-size: 12px; color: var(--spec-font-color-4); margin-top: 18px; line-height: 1.6; }

  @media (max-width: 900px) {
    .hero { grid-template-columns: 1fr; text-align: center; }
    .losers, .news-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 1199px) { .news-grid { grid-template-columns: repeat(2, 1fr); } }
`;

interface Props {
  dip: DipIndex;
  snapshot: string;
  losers: NewsItem[];
  dipNews: NewsItem[];
  delta: number | null;
  history: { date: string; value: number }[];
  sibling?: CrossLink | null;
}

export default function DipIndexView({ dip, snapshot, losers, dipNews, delta, history, sibling }: Props) {
  // GEO-citable fact: consecutive days in the 抄底 (>=60) zone.
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].value >= 60; i--) streak++;
  const c = zoneColor(dip.value);
  const updated = dip.updated ? new Date(dip.updated).toLocaleString('zh-TW', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  return (
    <div className="wrap">
      <nav className="crumbs"><Link href="/news">首頁</Link> / BYDFi 抄底指數</nav>

      <section className="hero">
        <div className="gauge" style={{ ['--c' as string]: c, ['--p' as string]: dip.value }}>
          <div className="inner">
            <span className="v">{dip.value}</span>
            <span className="l">{dip.label}</span>
            <span className="s">/ 100</span>
          </div>
        </div>
        <div>
          <h1 className="t">BYDFi 抄底指數</h1>
          <p className="snap">{snapshot}</p>
          <div className="updated">
            更新時間：{updated}（每 2 小時自動計算）
            {delta !== null && <> · 較昨日 <span style={{ color: delta >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}</span></>}
          </div>
        </div>
      </section>

      {sibling && <CycleCrossLink {...sibling} />}

      {history.length >= 2 && (
        <div className="panel">
          <h2>指數走勢（近 {history.length} 天）</h2>
          <div className="sub">
            {streak > 0
              ? `已連續 ${streak} 天處於抄底區間（≥60）`
              : '近期指數區間變化'}
          </div>
          <DipChart history={history} />
        </div>
      )}

      <div className="panel">
        <h2>指數構成（透明計分）</h2>
        <div className="sub">{dip.components.length} 項訊號加權合成（鏈上估值 · 技術 · 情緒 · 新聞），分數越高代表越偏向「恐懼／超賣／抄底」</div>
        {dip.components.map((co) => (
          <div key={co.name} className="comp">
            <span className="comp-name">{co.name}</span>
            <span className="comp-desc">{co.desc}</span>
            <span className="comp-bar"><i style={{ width: `${co.score}%`, background: zoneColor(co.score) }} /></span>
            <span className="comp-score">{co.score}<span className="w"> ·{co.weight}%</span></span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>多賺多少？</h2>
        <div className="sub">回溯歷史 BTC 行情：如果當時按抄底訊號進場，你今天會多賺多少。</div>
        <BacktestTool mode="dip" />
      </div>

      {losers.length > 0 && (
        <div className="panel">
          <h2>🩸 抄底幣種榜（24h 跌幅最深）</h2>
          <div className="sub">BYDFi 可交易幣種 · 點擊直接前往現貨交易</div>
          <div className="losers">
            {losers.map((it, i) => {
              const { price, chg } = parse(it.content);
              return (
                <a key={it.id} className="loser-row" href={it.url} target="_blank" rel="noopener noreferrer">
                  <span className="loser-rank">{i + 1}</span>
                  <span className="loser-name">{it.title}</span>
                  {price && <span className="loser-price">{price}</span>}
                  {chg !== null && <span className="loser-chg">{chg.toFixed(2)}%</span>}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {dipNews.length > 0 && (
        <div className="panel">
          <h2>📰 抄底情報</h2>
          <div className="sub">市場回調、增持、超賣相關新聞</div>
          <div className="news-grid">
            {dipNews.slice(0, 8).map((it) => <NewsCard key={it.id} item={it} />)}
          </div>
        </div>
      )}

      <div className="panel">
        <h2>方法論</h2>
        <p className="method">
          BYDFi 抄底指數是 BYDFi News 自有的複合訊號，把<b>多方數據</b>整合為單一 0–100 指標，涵蓋四個維度：
          <b>鏈上估值</b>（MVRV Z-Score、NUPL 淨未實現損益）、
          <b>技術面</b>（BTC 距歷史高點回調、200 日均線偏離、14 日 RSI 超賣）、
          <b>市場情緒</b>（恐懼貪婪指數、永續資金費率）、
          以及我們獨家的<b>新聞恐慌度</b>（近 24 小時崩跌類新聞佔比）。
          各項標準化後加權合成，分數越高代表市場越偏向恐懼/超賣，歷史上常對應較佳的累積區間。
          資料來源：bitcoin-data.com（鏈上）、Alternative.me、CoinGecko、Binance 與 BYDFi News 新聞流。
        </p>
        <p className="disclaimer">
          ⚠️ 本指數僅供市場參考與教育用途，不構成投資建議。加密貨幣價格波動劇烈，請自行研究並評估風險。
        </p>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}
