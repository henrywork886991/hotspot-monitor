'use client';

import { useState } from 'react';
import css from 'styled-jsx/css';

interface Result {
  mode: string;
  date: string;
  amount: number;
  priceThen: number;
  priceNow: number;
  btc: number;
  valueNow: number;
  diff: number;
  pct: number;
}

const PICKS: Record<'top' | 'dip', { date: string; label: string }[]> = {
  top: [
    { date: '2021-11-09', label: '2021 頂部' },
    { date: '2017-12-17', label: '2017 頂部' },
    { date: '2024-03-14', label: '2024 ETF 頂' },
  ],
  dip: [
    { date: '2022-11-21', label: 'FTX 崩盤底' },
    { date: '2020-03-13', label: 'COVID 底' },
    { date: '2018-12-15', label: '2018 熊底' },
  ],
};

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

const styles = css`
  .bt { }
  .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
  .fld { display: flex; flex-direction: column; gap: 6px; }
  .fld label { font-size: 12px; color: var(--spec-font-color-3); }
  .fld input { background: var(--spec-background-color-4); border: 1px solid var(--spec-border-level-2); border-radius: 8px; padding: 9px 12px; font-size: 14px; color: var(--spec-font-color-1); min-width: 150px; }
  .go { background: var(--skin-primary-color); color: #1a1a1a; font-weight: 800; border: none; border-radius: 8px; padding: 10px 22px; font-size: 14px; cursor: pointer; }
  .go:disabled { opacity: .5; cursor: default; }
  .picks { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .pick { font-size: 12px; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--spec-border-level-2); background: var(--spec-background-color-4); color: var(--spec-font-color-2); cursor: pointer; }
  .pick.on { border-color: var(--skin-primary-color); color: var(--spec-font-color-1); }
  .result { margin-top: 18px; padding: 18px 20px; border-radius: 12px; background: var(--spec-background-color-4); }
  .big { font-size: 30px; font-weight: 900; line-height: 1.2; }
  .rtext { font-size: 14px; color: var(--spec-font-color-2); margin-top: 8px; line-height: 1.7; }
  .rtext b { color: var(--spec-font-color-1); }
  .err { margin-top: 14px; font-size: 13px; color: var(--color-red); }
`;

export default function BacktestTool({ mode }: { mode: 'top' | 'dip' }) {
  const [date, setDate] = useState(PICKS[mode][0].date);
  const [amount, setAmount] = useState('10000');
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true); setErr(''); setRes(null);
    try {
      const r = await fetch(`/api/backtest?date=${date}&amount=${amount}&mode=${mode}`);
      const j = await r.json();
      if (!r.ok) { setErr(j.error === 'price unavailable' ? '暫時取不到該日價格，請稍後再試或換個日期' : '查詢失敗，請確認日期與金額'); }
      else setRes(j);
    } catch {
      setErr('查詢失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  const verb = mode === 'top' ? '離場' : '抄底';
  const helped = res ? res.diff >= 0 : true;
  const resultColor = mode === 'top'
    ? (helped ? 'var(--color-green)' : 'var(--color-red)')
    : (helped ? 'var(--color-green)' : 'var(--color-red)');

  return (
    <div className="bt">
      <div className="row">
        <div className="fld">
          <label>{mode === 'top' ? '清倉日期' : '抄底日期'}</label>
          <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="fld">
          <label>金額（USD）</label>
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button className="go" onClick={run} disabled={loading || !date || !amount}>{loading ? '推演中…' : '推演 →'}</button>
      </div>

      <div className="picks">
        {PICKS[mode].map((p) => (
          <button key={p.date} className={`pick ${date === p.date ? 'on' : ''}`} onClick={() => setDate(p.date)}>
            {p.date} · {p.label}
          </button>
        ))}
      </div>

      {err && <div className="err">{err}</div>}

      {res && (
        <div className="result">
          <div className="big" style={{ color: resultColor }}>
            {mode === 'top'
              ? (helped ? `少虧 ${usd(res.diff)}` : `反而少賺 ${usd(-res.diff)}`)
              : (helped ? `多賺 ${usd(res.diff)}` : `反而虧 ${usd(-res.diff)}`)}
            <span style={{ fontSize: 16, marginLeft: 8 }}>（{res.pct >= 0 ? '+' : ''}{res.pct.toFixed(1)}%）</span>
          </div>
          <div className="rtext">
            {res.date} 當天 BTC 約 <b>{usd(res.priceThen)}</b>，今天約 <b>{usd(res.priceNow)}</b>。
            你在當天用 <b>{usd(res.amount)}</b> {verb}（約 {res.btc.toFixed(4)} BTC），
            若一路持有到今天價值約 <b>{usd(res.valueNow)}</b>。
            {mode === 'top'
              ? (helped ? `當時按逃頂訊號離場，可少虧 ${usd(res.diff)}。` : `這段期間 BTC 反而上漲，當時離場會少賺。`)
              : (helped ? `當時按抄底訊號進場，至今多賺 ${usd(res.diff)}。` : `這段期間 BTC 下跌，當時進場會虧損。`)}
          </div>
        </div>
      )}

      <style jsx>{styles}</style>
    </div>
  );
}
