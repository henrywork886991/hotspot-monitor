'use client';

import Link from 'next/link';
import { NewsItem } from '@/types';
import { relTime, clockTime } from '@/lib/format';
import { IMPORTANCE_CONFIG, sourceColor } from '@/lib/news-style';
import { articlePath, coinPath } from '@/lib/site';
import { DipIndex, TopIndex } from '@/lib/market-extras';
import css from 'styled-jsx/css';

export interface HotCoin { base: string; pair: string; count: number }

function dipColor(v: number): string {
  if (v >= 75) return 'var(--color-green)';
  if (v >= 60) return '#9acd32';
  if (v >= 45) return '#f6a623';
  return 'var(--color-red)';
}

// Top index uses the inverse colour scale: high = hot/overheated = danger.
function topColor(v: number): string {
  if (v >= 75) return 'var(--color-red)';
  if (v >= 60) return '#ff6b3d';
  if (v >= 45) return '#f6a623';
  return 'var(--color-green)';
}

const SIGNUP_URL = 'https://www.bydfi.com/en/register';

/* Activities (≈ BYDFi 'Activities' / cmsBannerActivities pool component).
   Static promo banners for now; trivially swappable for a CMS feed on port. */
const ACTIVITIES: { icon: string; title: string; tag: string; tagColor: string; href: string }[] = [
  { icon: '🎉', title: '新用戶任務中心 — 完成任務領 $5,050 獎勵', tag: '新人福利', tagColor: '#0ecb81', href: 'https://www.bydfi.com/en' },
  { icon: '🏆', title: '合約交易大賽 — 瓜分 $100,000 獎池',        tag: '限時賽事', tagColor: '#f6465d', href: 'https://www.bydfi.com/en' },
  { icon: '💳', title: 'BYDFi Card — 加密貨幣消費最高 8% 返現',    tag: '熱門',    tagColor: '#ffd30f', href: 'https://www.bydfi.com/en' },
];

const styles = css`
  .sidebar { display: flex; flex-direction: column; gap: 16px; }
  .panel {
    background: var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
    border-radius: 12px;
    overflow: hidden;
  }
  .panel-head {
    display: flex; align-items: center; gap: 8px;
    padding: 14px 16px; border-bottom: 1px solid var(--spec-border-level-2);
    font-size: 14px; font-weight: 700; color: var(--spec-font-color-1);
  }

  /* Register CTA (≈ BYDFi 'Register' pool component) */
  .cta {
    display: block;
    padding: 20px 18px;
    border-radius: 12px;
    background:
      radial-gradient(120% 120% at 100% 0%, rgba(255,211,15,0.18) 0%, rgba(255,211,15,0) 55%),
      var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2);
    text-align: left;
  }
  .cta-kicker { font-size: 12px; font-weight: 700; color: var(--skin-primary-color); letter-spacing: 0.3px; }
  .cta-title { font-size: 18px; font-weight: 800; color: var(--spec-font-color-1); margin: 6px 0 4px; line-height: 1.3; }
  .cta-sub { font-size: 12px; color: var(--spec-font-color-2); line-height: 1.5; margin-bottom: 14px; }
  .cta-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; padding: 10px; border-radius: 8px;
    background: var(--skin-primary-color); color: var(--spec-brand-bg-font-color);
    font-size: 14px; font-weight: 800; transition: background 0.15s;
  }
  .cta:hover .cta-btn { background: var(--skin-primary-bg-hover-color); }
  .live-dot {
    width: 7px; height: 7px; border-radius: 50%; background: var(--color-red);
    box-shadow: 0 0 0 0 rgba(246,70,93,0.6); animation: pulse 1.8s infinite;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(246,70,93,0.55); }
    70% { box-shadow: 0 0 0 6px rgba(246,70,93,0); }
    100% { box-shadow: 0 0 0 0 rgba(246,70,93,0); }
  }

  /* Trending */
  :global(.trend-row) {
    display: flex; gap: 12px; padding: 12px 16px; cursor: pointer;
    border-bottom: 1px solid var(--spec-border-level-1); transition: background 0.12s;
  }
  :global(.trend-row:last-child) { border-bottom: none; }
  :global(.trend-row:hover) { background: var(--spec-background-color-4); }
  .rank {
    font-size: 15px; font-weight: 800; font-style: italic; width: 20px; flex-shrink: 0;
    color: var(--spec-font-color-4);
  }
  .rank.top { color: var(--skin-primary-color); }
  .trend-main { min-width: 0; }
  .trend-title {
    font-size: 13px; font-weight: 600; line-height: 1.45; color: var(--spec-font-color-1);
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
  }
  .trend-meta { font-size: 11px; color: var(--spec-font-color-3); margin-top: 4px; }
  .trend-meta .s { font-weight: 700; text-transform: uppercase; }

  /* BYDFi 抄底指數 card */
  :global(.dip-card) {
    display: block; padding: 16px 18px; border-radius: 12px;
    background: radial-gradient(120% 120% at 100% 0%, rgba(14,203,129,0.12) 0%, rgba(14,203,129,0) 55%), var(--spec-background-color-3);
    border: 1px solid var(--spec-border-level-2); transition: border-color .15s;
  }
  :global(.dip-card:hover) { border-color: var(--skin-primary-color); }
  .dip-top { display: flex; align-items: center; gap: 14px; }
  .dip-gauge {
    position: relative; width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .dip-gauge::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%;
    background: conic-gradient(var(--c) calc(var(--p) * 1%), var(--spec-background-color-4) 0);
    -webkit-mask: radial-gradient(closest-side, transparent 68%, #000 70%);
    mask: radial-gradient(closest-side, transparent 68%, #000 70%);
  }
  .dip-v { font-size: 19px; font-weight: 900; }
  .dip-name { font-size: 13px; font-weight: 800; color: var(--spec-font-color-1); }
  .dip-label { font-size: 14px; font-weight: 800; margin: 2px 0; }
  .dip-go { font-size: 11px; color: var(--skin-primary-color); font-weight: 700; }

  /* Hot coins */
  .coins { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 16px; }
  :global(.coin-chip) {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 10px; border-radius: 8px;
    background: var(--spec-background-color-4); border: 1px solid var(--spec-border-level-3);
    transition: border-color .15s, transform .15s;
  }
  :global(.coin-chip:hover) { border-color: var(--skin-primary-color); transform: translateY(-1px); }
  .coin-t { font-size: 13px; font-weight: 800; color: var(--skin-primary-color); }
  .coin-c { font-size: 11px; color: var(--spec-font-color-3); }

  /* Activities */
  .act-row {
    display: flex; align-items: center; gap: 11px; padding: 12px 16px; cursor: pointer;
    border-bottom: 1px solid var(--spec-border-level-1); transition: background 0.12s;
  }
  .act-row:last-child { border-bottom: none; }
  .act-row:hover { background: var(--spec-background-color-4); }
  .act-icon {
    flex-shrink: 0; width: 34px; height: 34px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; font-size: 17px;
    background: var(--spec-background-color-4);
  }
  .act-main { min-width: 0; flex: 1; }
  .act-title {
    font-size: 12.5px; font-weight: 600; line-height: 1.45; color: var(--spec-font-color-1);
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
  }
  .act-tag {
    display: inline-block; margin-top: 5px; font-size: 10px; font-weight: 700;
    padding: 1px 7px; border-radius: 4px;
  }

  /* Live feed */
  .live { position: relative; padding: 6px 16px 14px; }
  .live::before {
    content: ''; position: absolute; left: 22px; top: 6px; bottom: 14px;
    width: 1px; background: var(--spec-border-level-3);
  }
  :global(.flash) { position: relative; display: block; padding: 9px 0 9px 22px; cursor: pointer; }
  :global(.flash:hover) .flash-title { color: var(--skin-primary-color); }
  .flash-node {
    position: absolute; left: 1px; top: 13px; width: 9px; height: 9px; border-radius: 50%;
    border: 2px solid var(--spec-background-color-3);
  }
  .flash-time { font-size: 11px; font-weight: 700; color: var(--spec-font-color-3); margin-bottom: 3px; }
  .flash-title {
    font-size: 12.5px; line-height: 1.5; color: var(--spec-font-color-2);
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
    transition: color 0.12s;
  }
  .empty { padding: 28px 16px; text-align: center; color: var(--spec-font-color-3); font-size: 12px; }

  @media (max-width: 1100px) { .sidebar { display: none; } }
`;

export default function NewsSidebar({ items = [], hotCoins = [], dipIndex, topIndex }: { items?: NewsItem[]; hotCoins?: HotCoin[]; dipIndex?: DipIndex | null; topIndex?: TopIndex | null }) {
  const trending = items
    .filter((i) => i.importance === 'urgent' || i.importance === 'high')
    .slice(0, 7);
  const live = items.slice(0, 16);

  return (
    <aside className="sidebar">
      <a className="cta" href={SIGNUP_URL} target="_blank" rel="noopener noreferrer">
        <div className="cta-kicker">新用戶專屬</div>
        <div className="cta-title">註冊即領 $5 體驗金</div>
        <div className="cta-sub">在 BYDFi 交易 400+ 幣種，現貨、合約、跟單一站搞定。</div>
        <div className="cta-btn">免費註冊 →</div>
      </a>

      {dipIndex && (
        <Link href="/dip-index" className="dip-card">
          <div className="dip-top">
            <div className="dip-gauge" style={{ ['--c' as string]: dipColor(dipIndex.value), ['--p' as string]: dipIndex.value }}>
              <span className="dip-v" style={{ color: dipColor(dipIndex.value) }}>{dipIndex.value}</span>
            </div>
            <div>
              <div className="dip-name">🩸 BYDFi 抄底指數</div>
              <div className="dip-label" style={{ color: dipColor(dipIndex.value) }}>{dipIndex.label}</div>
              <div className="dip-go">查看完整指數 →</div>
            </div>
          </div>
        </Link>
      )}

      {topIndex && (
        <Link href="/top-signal" className="dip-card">
          <div className="dip-top">
            <div className="dip-gauge" style={{ ['--c' as string]: topColor(topIndex.value), ['--p' as string]: topIndex.value }}>
              <span className="dip-v" style={{ color: topColor(topIndex.value) }}>{topIndex.value}</span>
            </div>
            <div>
              <div className="dip-name">🚀 BYDFi 逃頂指數</div>
              <div className="dip-label" style={{ color: topColor(topIndex.value) }}>{topIndex.label} · {topIndex.triggered_count}/{topIndex.total} 觸發</div>
              <div className="dip-go">查看頂部訊號 →</div>
            </div>
          </div>
        </Link>
      )}

      {hotCoins.length > 0 && (
        <div className="panel">
          <div className="panel-head">🔥 熱門幣種</div>
          <div className="coins">
            {hotCoins.map((c) => (
              <Link key={c.base} href={coinPath(c.base)} className="coin-chip" title={`${c.base} 相關新聞與交易`}>
                <span className="coin-t">{c.base}</span>
                <span className="coin-c">{c.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">🔥 熱門排行</div>
        {trending.length === 0 ? (
          <div className="empty">暫無熱門</div>
        ) : (
          trending.map((it, i) => {
            const c = sourceColor(it.source);
            return (
              <Link key={it.id} href={articlePath(it)} className="trend-row">
                <span className={`rank${i < 3 ? ' top' : ''}`}>{i + 1}</span>
                <div className="trend-main">
                  <div className="trend-title">{it.title}</div>
                  <div className="trend-meta">
                    <span className="s" style={{ color: c }}>{it.source}</span>
                    {' · '}{relTime(it.published_at || it.fetched_at)}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="panel">
        <div className="panel-head">🎁 活動專區</div>
        {ACTIVITIES.map((a) => (
          <a key={a.title} className="act-row" href={a.href} target="_blank" rel="noopener noreferrer">
            <span className="act-icon">{a.icon}</span>
            <div className="act-main">
              <div className="act-title">{a.title}</div>
              <span className="act-tag" style={{ color: a.tagColor, background: `${a.tagColor}1f` }}>{a.tag}</span>
            </div>
          </a>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head"><span className="live-dot" />24/7 快訊</div>
        {live.length === 0 ? (
          <div className="empty">暫無快訊</div>
        ) : (
          <div className="live">
            {live.map((it) => {
              const imp = it.importance ? IMPORTANCE_CONFIG[it.importance] : null;
              const dot = imp?.color ?? 'var(--spec-font-color-3)';
              return (
                <Link key={it.id} href={articlePath(it)} className="flash">
                  <span className="flash-node" style={{ background: dot }} />
                  <div className="flash-time">{clockTime(it.published_at || it.fetched_at)}</div>
                  <div className="flash-title">{it.title}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{styles}</style>
    </aside>
  );
}
