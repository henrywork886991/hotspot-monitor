'use client';

import Link from 'next/link';
import css from 'styled-jsx/css';

// Internal link between the two flagship cycle tools (抄底 ↔ 逃頂). Keeps neither
// page orphaned and passes link equity both ways — 守則「內部連結完整」.
interface Props {
  href: string;
  emoji: string;
  title: string;     // sibling index name
  value: number;     // sibling current value
  label: string;     // sibling zone label
  color: string;     // sibling zone colour
  blurb: string;     // one-line invitation
}

const styles = css`
  .x {
    display: flex; align-items: center; gap: 16px;
    padding: 16px 20px; margin-top: 18px; border-radius: 14px;
    background: var(--spec-background-color-3); border: 1px solid var(--spec-border-level-2);
    transition: border-color .15s;
  }
  :global(a.x:hover) { border-color: var(--skin-primary-color); }
  .badge { flex-shrink: 0; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; background: var(--spec-background-color-4); }
  .mid { flex: 1; min-width: 0; }
  .name { font-size: 14px; font-weight: 800; color: var(--spec-font-color-1); }
  .val { font-size: 13px; font-weight: 700; margin-top: 2px; }
  .blurb { font-size: 12px; color: var(--spec-font-color-3); margin-top: 3px; }
  .go { flex-shrink: 0; font-size: 13px; font-weight: 700; color: var(--skin-primary-color); }
`;

export default function CycleCrossLink({ href, emoji, title, value, label, color, blurb }: Props) {
  return (
    <Link href={href} className="x">
      <span className="badge">{emoji}</span>
      <span className="mid">
        <span className="name">{title}</span>
        <div className="val" style={{ color }}>目前 {value} · {label}</div>
        <div className="blurb">{blurb}</div>
      </span>
      <span className="go">查看 →</span>
      <style jsx>{styles}</style>
    </Link>
  );
}
