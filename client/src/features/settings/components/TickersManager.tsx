import { Pencil, X } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ConfirmModal, ModalFrame, showToast } from '@/components/ui';
import {
  useCachedTickers,
  useDeleteCachedTicker,
  useRenameTicker,
} from '@/features/portfolio/hooks/useStocks';
import { SettingsManagerSkeleton } from '@/features/settings/components/SettingsManager';
import { fmtCurrency, fmtDate } from '@/lib/format';

const TICKER_MAX_LENGTH = 20;

export function TickersManager() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { data: tickers = [], isLoading } = useCachedTickers();
  const deleteTicker = useDeleteCachedTicker();
  const renameTicker = useRenameTicker();
  const [pending, setPending] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState('');

  if (isLoading) return <SettingsManagerSkeleton />;

  const total = tickers.length;
  const deletable = tickers.filter((tk) => !tk.in_use).length;

  const inUseTooltip = (tk: (typeof tickers)[number]): string => {
    const reasons: string[] = [];
    if ((tk.held_in ?? []).length > 0) {
      reasons.push(t('tickers.held_in', { accounts: tk.held_in.join(', ') }));
    }
    if (tk.used_by_others) {
      reasons.push(t('tickers.used_by_others'));
    }
    if (tk.has_price_history) {
      reasons.push(t('tickers.has_history'));
    }
    return reasons.join('\n');
  };

  const openEdit = (ticker: string) => {
    setEditing(ticker);
    setNewTicker(ticker);
  };

  const submitRename = (e: SubmitEvent) => {
    e.preventDefault();
    if (!editing) return;
    const value = newTicker.trim().toUpperCase();
    if (!value || value === editing) return;
    renameTicker.mutate(
      { ticker: editing, newTicker: value },
      {
        onSuccess: () => {
          setEditing(null);
          showToast(t('tickers.renamed', { ticker: editing, to: value }));
        },
        onError: () => setEditing(null),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[10px] font-bold text-content-subtle uppercase tracking-widest">
        {t('tickers.title')}
      </p>
      <p className="text-sm text-content-muted">{t('tickers.description')}</p>

      {total === 0 && (
        <div className="text-center py-8 text-content-faint text-sm border-2 border-dashed border-line-subtle rounded-2xl">
          {t('tickers.empty')}
        </div>
      )}

      {total > 0 && (
        <>
          <p className="text-[11px] font-medium text-content-subtle tabular-nums">
            {t('tickers.summary', { total, deletable })}
          </p>
          <div className="flex flex-col gap-3">
            {tickers.map((tk) => (
              <article
                key={tk.ticker}
                aria-label={tk.ticker}
                className="flex items-center gap-3 p-4 bg-surface rounded-2xl border border-line-subtle shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm tracking-tight font-mono">{tk.ticker}</p>
                  {tk.name && (
                    <p className="text-[10px] text-content-subtle truncate" title={tk.name}>
                      {tk.name}
                    </p>
                  )}
                  <p className="text-[10px] text-content-faint tabular-nums">
                    {fmtCurrency(tk.price, tk.currency)} · {fmtDate(tk.fetched_at.slice(0, 10))}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-label={t('tickers.rename_label', { ticker: tk.ticker })}
                    onClick={() => openEdit(tk.ticker)}
                    className="p-1.5 text-content-subtle hover:bg-surface-muted rounded-lg transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  {tk.in_use ? (
                    <span
                      className="text-[10px] px-2 py-1 rounded-lg bg-surface-muted text-content-subtle border border-line-subtle shrink-0 cursor-help"
                      title={inUseTooltip(tk)}
                    >
                      {t('tickers.in_use')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={t('tickers.delete_label', { ticker: tk.ticker })}
                      onClick={() => setPending(tk.ticker)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {pending && (
        <ConfirmModal
          title={t('tickers.delete_title', { ticker: pending })}
          body={t('tickers.delete_body')}
          onConfirm={() =>
            deleteTicker.mutate(pending, {
              onSuccess: () => {
                setPending(null);
                showToast(t('tickers.deleted', { ticker: pending }));
              },
              onError: () => setPending(null),
            })
          }
          onCancel={() => setPending(null)}
          isPending={deleteTicker.isPending}
        />
      )}

      {editing && (
        <ModalFrame
          title={t('tickers.rename_title', { ticker: editing })}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)} disabled={renameTicker.isPending}>
                {tc('cancel')}
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="ticker-rename-form"
                disabled={renameTicker.isPending}
              >
                {renameTicker.isPending ? tc('loading') : t('tickers.rename_submit')}
              </Button>
            </>
          }
        >
          <form id="ticker-rename-form" onSubmit={submitRename}>
            <label
              htmlFor="ticker-rename-input"
              className="block text-sm font-medium text-content-subtle mb-1"
            >
              {t('tickers.rename_label_input')}
            </label>
            <input
              id="ticker-rename-input"
              value={newTicker}
              maxLength={TICKER_MAX_LENGTH}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-surface-muted border border-line rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <p className="text-[11px] text-content-muted mt-2">
              {t('tickers.rename_hint', { ticker: editing })}
            </p>
          </form>
        </ModalFrame>
      )}
    </div>
  );
}
