import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card } from '@/components/ui';
import { ImportErrorMessage } from '@/features/settings/components/import/Shared';
import { fmtDate } from '@/lib/format';
import type { ImportErrors, PreviewItem, SkipReason } from '@/lib/import.helpers';

interface PreviewStepProps {
  previewItems: PreviewItem[];
  selected: Set<number>;
  importableCount: number;
  skippedCount: number;
  selectedTxCount: number;
  selectedTfCount: number;
  toggleItem: (i: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  isPending: boolean;
  importErrors: ImportErrors;
  errorMessage: string | null;
  onBack: () => void;
  onImport: () => void;
}

export function PreviewStep({
  previewItems,
  selected,
  importableCount,
  skippedCount,
  selectedTxCount,
  selectedTfCount,
  toggleItem,
  selectAll,
  deselectAll,
  isPending,
  importErrors,
  errorMessage,
  onBack,
  onImport,
}: Readonly<PreviewStepProps>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');

  const skipReasonLabel = (reason: SkipReason) => t(`import.skip_reason.${reason}`);

  const errorCount = importErrors.rows.size + importErrors.global.length;
  const hasStructuredErrors = errorCount > 0;

  // Encadré rouge listant les motifs d'erreur d'une ligne (colonne pleine largeur).
  const renderRowErrors = (rowIndex: number) => {
    const messages = importErrors.rows.get(rowIndex);
    if (!messages) return null;
    return (
      <tr>
        <td colSpan={6} className="pb-2">
          <div className="text-danger bg-danger-surface border border-danger/40 rounded-lg px-3 py-1.5">
            <ul className="list-disc list-inside space-y-0.5">
              {messages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </td>
      </tr>
    );
  };

  const rowAccent = (rowIndex: number) =>
    importErrors.rows.has(rowIndex) ? 'bg-danger-surface/40' : '';

  const categoryText = (item: Extract<PreviewItem, { kind: 'transaction' }>) => {
    if (!item.categoryLabel) return '—';
    if (!item.categoryIsNew) return item.categoryLabel;
    return `${item.categoryLabel} ${t('import.category_new_suffix')}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4">
        {[
          { value: selectedTxCount, label: t('import.stats_transactions') },
          { value: selectedTfCount, label: t('import.stats_transfers') },
          { value: skippedCount, label: t('import.stats_ignored') },
        ].map(({ value, label }) => (
          <div
            key={label}
            className="flex-1 bg-surface border border-line-subtle rounded-2xl p-4 shadow-sm text-center"
          >
            <p className="text-2xl font-display text-content">{value}</p>
            <p className="text-xs text-content-subtle mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-content-subtle">
            {t('import.preview_transactions', {
              importable: importableCount,
              skipped: skippedCount,
            })}
          </p>
          <label className="flex items-center gap-2 text-xs text-content-muted cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === importableCount && importableCount > 0}
              onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
              className="rounded"
            />
            <span>{tc('all_select')}</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-content-subtle border-b border-line-subtle">
                <th className="pb-2 w-6" />
                <th className="pb-2 pr-3">{tc('date')}</th>
                <th className="pb-2 pr-3">{t('import.col_description')}</th>
                <th className="pb-2 pr-3">{t('import.col_account')}</th>
                <th className="pb-2 pr-3">{t('import.col_category')}</th>
                <th className="pb-2 text-right">{tc('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {previewItems.map((item, i) => {
                if (item.kind === 'skip') {
                  return (
                    <tr
                      key={`skip-${item.idx}`}
                      className="text-content-faint border-b border-line-subtle"
                    >
                      <td className="py-1.5 w-6" />
                      <td className="py-1.5 pr-3">{item.date ? fmtDate(item.date) : '—'}</td>
                      <td className="py-1.5 pr-3 max-w-40 truncate" title={item.description}>
                        {item.description || t('import.no_description')}
                      </td>
                      <td className="py-1.5 pr-3 italic text-content-faint" colSpan={2}>
                        {skipReasonLabel(item.reason)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{item.amount.toFixed(2)}</td>
                    </tr>
                  );
                }
                const isChecked = selected.has(i);
                if (item.kind === 'transfer') {
                  return (
                    <Fragment key={`transfer-${item.idxPrimary}`}>
                      <tr
                        className={`border-b border-line-subtle ${isChecked ? '' : 'opacity-40'} ${rowAccent(i)}`}
                      >
                        <td className="py-1.5 w-6">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(i)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-1.5 pr-3">{fmtDate(item.date)}</td>
                        <td className="py-1.5 pr-3 max-w-40 truncate" title={item.description}>
                          {item.description}
                        </td>
                        <td className="py-1.5 pr-3 text-info">
                          {item.fromAccountName}
                          {item.fromAccountSourceName ? t('import.new_account_suffix') : ''} →{' '}
                          {item.toAccountName}
                          {item.toAccountSourceName ? t('import.new_account_suffix') : ''}
                        </td>
                        <td className="py-1.5 pr-3 text-content-subtle italic">
                          {t('import.transfer_label')}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-info">
                          {item.amount.toFixed(2)} €
                        </td>
                      </tr>
                      {renderRowErrors(i)}
                    </Fragment>
                  );
                }
                return (
                  <Fragment key={`tx-${item.idx}`}>
                    <tr
                      className={`border-b border-line-subtle ${isChecked ? '' : 'opacity-40'} ${rowAccent(i)}`}
                    >
                      <td className="py-1.5 w-6">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(i)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-1.5 pr-3">{fmtDate(item.date)}</td>
                      <td className="py-1.5 pr-3 max-w-40 truncate" title={item.description}>
                        {item.description || t('import.no_description')}
                      </td>
                      <td className="py-1.5 pr-3 text-content-secondary">
                        {item.accountName}
                        {item.newAccountSourceName ? t('import.new_account_suffix') : ''}
                      </td>
                      <td className="py-1.5 pr-3 text-content-subtle">{categoryText(item)}</td>
                      <td
                        className={`py-1.5 text-right tabular-nums ${item.type === 'income' ? 'text-success' : 'text-content'}`}
                      >
                        {item.type === 'expense' ? '-' : '+'}
                        {item.amount.toFixed(2)} €
                      </td>
                    </tr>
                    {renderRowErrors(i)}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {hasStructuredErrors && (
        <div className="text-sm text-danger bg-danger-surface border border-danger/30 rounded-lg px-3 py-2">
          <p className="font-medium">{t('import.errors_summary', { count: errorCount })}</p>
          {importErrors.global.length > 0 && (
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              {importErrors.global.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!hasStructuredErrors && errorMessage && <ImportErrorMessage message={errorMessage} />}

      <div className="flex justify-between">
        <Button onClick={onBack}>{tc('back')}</Button>
        <Button variant="primary" onClick={onImport} disabled={selected.size === 0 || isPending}>
          {isPending ? t('import.importing') : t('import.import_n', { count: selected.size })}
        </Button>
      </div>
    </div>
  );
}
