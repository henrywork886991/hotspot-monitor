'use client';

import css from 'styled-jsx/css';
import { useLocale } from './LocaleProvider';
import { t } from '@/lib/i18n/messages';

const TYPE_OPTIONS = [
  { key: 'all',    tkey: 'filter.all'    },
  { key: 'urgent', tkey: 'filter.urgent' },
  { key: 'high',   tkey: 'filter.high'   },
  { key: 'medium', tkey: 'filter.medium' },
  { key: 'low',    tkey: 'filter.low'    },
];

const styles = css`
  .type-filter {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .type-btn {
    padding: 5px 14px;
    border-radius: 4px;
    border: 1px solid var(--spec-border-level-3);
    background: transparent;
    color: var(--spec-font-color-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    height: 30px;
  }
  .type-btn:hover {
    border-color: var(--skin-primary-color);
    color: var(--spec-font-color-1);
  }
  .type-btn.active {
    background: var(--skin-primary-color);
    border-color: var(--skin-primary-color);
    color: var(--spec-brand-bg-font-color);
    font-weight: 600;
  }
`;

interface Props {
  current: string;
  onChange: (key: string) => void;
}

export default function TypeFilter({ current, onChange }: Props) {
  const locale = useLocale();
  return (
    <div className="type-filter">
      {TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          className={`type-btn${current === opt.key ? ' active' : ''}`}
          onClick={() => onChange(opt.key)}
        >
          {t(locale, opt.tkey)}
        </button>
      ))}
      <style jsx>{styles}</style>
    </div>
  );
}
