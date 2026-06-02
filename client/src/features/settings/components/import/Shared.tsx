import { useTranslation } from 'react-i18next';

import type { QifParseResult } from '@/lib/qif-parser.ts';
import type { XhbParseResult } from '@/lib/xhb-parser.ts';
import type { Bank } from '@/types.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Step =
  | 'upload'
  | 'accounts'
  | 'categories'
  | 'paymethods'
  | 'preview'
  | 'confirm'
  | 'done';

export type ParsedFile =
  | { format: 'qif'; data: QifParseResult }
  | { format: 'xhb'; data: XhbParseResult }
  | { format: 'json'; data: unknown };

// ─── findBankByName ───────────────────────────────────────────────────────────

export function findBankByName(bankname: string, banks: Bank[]): number | null {
  if (!bankname) return banks[0]?.id ?? null;
  const lower = bankname.toLowerCase();
  const exact = banks.find((b) => b.name.toLowerCase() === lower);
  if (exact) return exact.id;
  const partial = banks.find(
    (b) => b.name.toLowerCase().includes(lower) || lower.includes(b.name.toLowerCase()),
  );
  return partial?.id ?? banks[0]?.id ?? null;
}

// ─── ParsedFileStats ──────────────────────────────────────────────────────────

export function ParsedFileStats({ pf }: Readonly<{ pf: ParsedFile }>) {
  const { t } = useTranslation('settings');
  if (pf.format === 'qif') {
    return (
      <>
        <span>
          {pf.data.transactions.length} {t('import.label_transactions_count')}
        </span>
        <span>
          {pf.data.uniqueCategories.length} {t('import.label_categories_count')}
        </span>
        {pf.data.uniqueTransferTargets.length > 0 && (
          <span>
            {pf.data.uniqueTransferTargets.length} {t('import.label_transfer_targets')}
          </span>
        )}
      </>
    );
  }
  if (pf.format === 'xhb') {
    return (
      <>
        <span>
          {pf.data.transactions.length} {t('import.label_transactions_count')}
        </span>
        <span>
          {pf.data.transfers.length} {t('import.stats_transfers')}
        </span>
        <span>
          {pf.data.uniqueCategories.length} {t('import.label_categories_count')}
        </span>
        {pf.data.uniquePaymodes.length > 0 && (
          <span>
            {pf.data.uniquePaymodes.length} {t('import.label_paymode_count')}
          </span>
        )}
      </>
    );
  }
  return null;
}

// ─── StepIndicator ────────────────────────────────────────────────────────────

const CONTAINER_STYLES = {
  active: 'bg-brand-600 text-white',
  completed: 'text-content-subtle',
  upcoming: 'text-content-faint',
} as const;

const BADGE_STYLES = {
  active: 'bg-white/20',
  completed: 'bg-surface-strong',
  upcoming: 'bg-surface-emphasis',
} as const;

const LINE_STYLES = {
  active: 'bg-surface-strong',
  completed: 'bg-surface-strong',
  upcoming: 'bg-surface-strong',
} as const;

function getStatus(index: number, cur: number) {
  if (index === cur) return 'active';
  if (index < cur) return 'completed';
  return 'upcoming';
}

// ─── ImportErrorMessage ──────────────────────────────────────────────────────

export function ImportErrorMessage({ message }: Readonly<{ message: string }>) {
  const { t: tc } = useTranslation('common');
  return (
    <div className="text-sm text-danger bg-danger-surface border border-danger/30 rounded-lg px-3 py-2">
      <p className="font-medium mb-1">{tc('error_import')}</p>
      <ul className="list-disc list-inside space-y-0.5">
        {message.split('\n').map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function StepIndicator({
  step,
  format,
}: Readonly<{ step: Step; format: 'qif' | 'xhb' | 'json' | null }>) {
  const { t } = useTranslation('settings');
  const steps: { id: Step; label: string }[] =
    format === 'json'
      ? [
          { id: 'upload', label: t('import.step_file') },
          { id: 'confirm', label: t('import.step_confirm') },
          { id: 'done', label: t('import.step_done') },
        ]
      : [
          { id: 'upload', label: t('import.step_file') },
          { id: 'accounts', label: t('import.step_accounts') },
          { id: 'categories', label: t('import.step_categories') },
          ...(format === 'xhb'
            ? [{ id: 'paymethods' as Step, label: t('import.step_paymethods') }]
            : []),
          { id: 'preview', label: t('import.step_preview') },
          { id: 'done', label: t('import.step_done') },
        ];
  const current = steps.findIndex((s) => s.id === step);

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${CONTAINER_STYLES[getStatus(i, current)]}`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${BADGE_STYLES[getStatus(i, current)]}`}
            >
              {i < current ? '✓' : i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-6 h-px ${LINE_STYLES[getStatus(i, current)]}`} />
          )}
        </div>
      ))}
    </div>
  );
}
