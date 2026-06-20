import { useTranslation } from 'react-i18next';

import type { CsvMapping } from '@/lib/csv-import.helpers';
import type { CsvParseResult } from '@/lib/csv-parser';

interface Props {
  csvRaw: CsvParseResult;
  mapping: Partial<CsvMapping>;
  onMappingChange: (m: Partial<CsvMapping>) => void;
  onDelimiterChange: (d: string) => void;
  onBack: () => void;
  onNext: (mapping: CsvMapping) => void;
}

const DELIMITER_LABELS: Record<string, string> = {
  ';': '; (point-virgule)',
  ',': ', (virgule)',
  '\t': 'TAB',
};

function ColSelect({
  label,
  value,
  headers,
  notMappedLabel,
  onChange,
}: Readonly<{
  label: string;
  value: number | undefined;
  headers: string[];
  notMappedLabel: string;
  onChange: (v: number | undefined) => void;
}>) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-content w-40 shrink-0">{label}</label>
      <select
        className="flex-1 text-sm border border-line-subtle rounded-lg px-3 py-1.5 bg-surface text-content focus:outline-none focus:ring-1 focus:ring-brand-500"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      >
        <option value="">{notMappedLabel}</option>
        {Array.from(headers.entries()).map(([i, h]) => (
          <option key={`col-${i}`} value={i}>
            {h || `Col. ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ColumnsStep({
  csvRaw,
  mapping,
  onMappingChange,
  onDelimiterChange,
  onBack,
  onNext,
}: Readonly<Props>) {
  const { t } = useTranslation('settings');

  const set = (patch: Partial<CsvMapping>) => onMappingChange({ ...mapping, ...patch });

  const amountMode = mapping.amountMode ?? 'signed';

  const canSubmit = (() => {
    if (mapping.dateCol === undefined || mapping.descriptionCol === undefined) return false;
    if (amountMode === 'signed' && mapping.amountCol === undefined) return false;
    if (amountMode === 'split' && mapping.debitCol === undefined && mapping.creditCol === undefined)
      return false;
    return true;
  })();

  const handleNext = () => {
    if (!canSubmit) return;
    const m: CsvMapping = {
      dateCol: mapping.dateCol!,
      descriptionCol: mapping.descriptionCol!,
      amountMode,
      amountCol: amountMode === 'signed' ? mapping.amountCol : undefined,
      debitCol: amountMode === 'split' ? mapping.debitCol : undefined,
      creditCol: amountMode === 'split' ? mapping.creditCol : undefined,
      categoryCol: mapping.categoryCol,
      notesCol: mapping.notesCol,
      decimalSep: mapping.decimalSep ?? ',',
      dateFormat: mapping.dateFormat ?? 'DD/MM',
    };
    onNext(m);
  };

  const notMapped = t('import.csv_not_mapped');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-content mb-1">{t('import.csv_columns_title')}</p>
        <p className="text-xs text-content-subtle">{t('import.csv_columns_hint')}</p>
      </div>

      {/* Champs requis */}
      <div className="space-y-3">
        <ColSelect
          label={t('import.csv_col_date')}
          value={mapping.dateCol}
          headers={csvRaw.headers}
          notMappedLabel={notMapped}
          onChange={(v) => set({ dateCol: v })}
        />
        <ColSelect
          label={t('import.csv_col_description')}
          value={mapping.descriptionCol}
          headers={csvRaw.headers}
          notMappedLabel={notMapped}
          onChange={(v) => set({ descriptionCol: v })}
        />
      </div>

      {/* Mode montant */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-content-subtle">
          {t('import.csv_col_amount')}
        </p>
        <div className="flex flex-col gap-1.5">
          {(['signed', 'split'] as const).map((mode) => (
            <label
              key={mode}
              className="flex items-center gap-2 text-sm cursor-pointer text-content"
            >
              <input
                type="radio"
                name="amountMode"
                value={mode}
                checked={amountMode === mode}
                onChange={() => set({ amountMode: mode })}
                className="accent-brand-500"
              />
              {t(`import.csv_amount_mode_${mode}`)}
            </label>
          ))}
        </div>

        {amountMode === 'signed' ? (
          <ColSelect
            label={t('import.csv_col_amount')}
            value={mapping.amountCol}
            headers={csvRaw.headers}
            notMappedLabel={notMapped}
            onChange={(v) => set({ amountCol: v })}
          />
        ) : (
          <div className="space-y-2 pl-4">
            <ColSelect
              label={t('import.csv_col_debit')}
              value={mapping.debitCol}
              headers={csvRaw.headers}
              notMappedLabel={notMapped}
              onChange={(v) => set({ debitCol: v })}
            />
            <ColSelect
              label={t('import.csv_col_credit')}
              value={mapping.creditCol}
              headers={csvRaw.headers}
              notMappedLabel={notMapped}
              onChange={(v) => set({ creditCol: v })}
            />
          </div>
        )}
      </div>

      {/* Champs optionnels */}
      <div className="space-y-3">
        <ColSelect
          label={t('import.csv_col_category')}
          value={mapping.categoryCol}
          headers={csvRaw.headers}
          notMappedLabel={notMapped}
          onChange={(v) => set({ categoryCol: v })}
        />
        <ColSelect
          label={t('import.csv_col_notes')}
          value={mapping.notesCol}
          headers={csvRaw.headers}
          notMappedLabel={notMapped}
          onChange={(v) => set({ notesCol: v })}
        />
      </div>

      <hr className="border-line-subtle" />

      {/* Paramètres de parsing */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-content-subtle">{t('import.csv_delimiter_label')}</label>
          <select
            className="text-sm border border-line-subtle rounded-lg px-3 py-1.5 bg-surface text-content focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={csvRaw.delimiter}
            onChange={(e) => onDelimiterChange(e.target.value)}
          >
            {Object.entries(DELIMITER_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>
                {lbl}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-content-subtle">{t('import.csv_decimal_label')}</label>
          <select
            className="text-sm border border-line-subtle rounded-lg px-3 py-1.5 bg-surface text-content focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={mapping.decimalSep ?? ','}
            onChange={(e) => set({ decimalSep: e.target.value as ',' | '.' })}
          >
            <option value=",">, (virgule)</option>
            <option value=".">. (point)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-content-subtle">{t('import.csv_date_format_label')}</label>
          <select
            className="text-sm border border-line-subtle rounded-lg px-3 py-1.5 bg-surface text-content focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={mapping.dateFormat ?? 'DD/MM'}
            onChange={(e) =>
              set({ dateFormat: e.target.value as 'DD/MM' | 'MM/DD' | 'YYYY-MM-DD' })
            }
          >
            <option value="DD/MM">DD/MM/YYYY</option>
            <option value="MM/DD">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </select>
        </div>
      </div>

      {/* Aperçu */}
      {csvRaw.sample.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-content-subtle mb-2">
            {t('import.csv_sample_title')}
          </p>
          <div className="overflow-x-auto rounded-lg border border-line-subtle">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-surface-muted">
                  {Array.from(csvRaw.headers.entries()).map(([i, h]) => (
                    <th
                      key={`th-${i}`}
                      className="px-2 py-1.5 text-left text-content-subtle font-medium border-b border-line-subtle"
                    >
                      {h || `Col. ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(csvRaw.sample.entries()).map(([ri, row]) => (
                  <tr key={`tr-${ri}`} className="even:bg-surface-muted">
                    {Array.from(row.entries()).map(([ci, cell]) => (
                      <td
                        key={`td-${ri}-${ci}`}
                        className="px-2 py-1 text-content truncate max-w-[12rem]"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="text-sm text-content-muted hover:text-content transition-colors"
        >
          ← {t('import.step_file')}
        </button>
        <button
          onClick={handleNext}
          disabled={!canSubmit}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('import.csv_next')}
        </button>
      </div>
    </div>
  );
}
