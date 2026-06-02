import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

// ─── Pagination ───────────────────────────────────────────────────────────────
const LIMIT_OPTIONS = [10, 25, 50, 100];

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}
export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onChange,
  onLimitChange,
}: Readonly<PaginationProps>) {
  const { t } = useTranslation('common');
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  function handlePageInput(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const val = Number.parseInt((e.target as HTMLInputElement).value, 10);
    if (!Number.isNaN(val) && val >= 1 && val <= totalPages) onChange(val);
    (e.target as HTMLInputElement).value = '';
  }

  return (
    <nav className="flex items-center justify-between pt-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-content-subtle">
          {t('pagination.info', { from, to, total })}
        </span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="text-xs text-content-muted bg-transparent border border-line rounded px-1.5 py-1 outline-none hover:border-line-strong transition-all"
        >
          {LIMIT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {t('pagination.per_page', { n: o })}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-line bg-surface text-content-secondary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title={t('pagination.first')}
        >
          «
        </button>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-line bg-surface text-content-secondary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title={t('pagination.prev')}
        >
          ←
        </button>
        <div className="flex items-center gap-1 px-1">
          <input
            type="number"
            min={1}
            max={totalPages}
            placeholder={String(page)}
            onKeyDown={handlePageInput}
            className="w-10 text-center text-xs text-content-secondary bg-surface border border-line rounded px-1 py-1 outline-none focus:border-line-strong transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-content-subtle">/ {totalPages}</span>
        </div>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-line bg-surface text-content-secondary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title={t('pagination.next')}
        >
          →
        </button>
        <button
          onClick={() => onChange(totalPages)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-line bg-surface text-content-secondary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title={t('pagination.last')}
        >
          »
        </button>
      </div>
    </nav>
  );
}
