import { ReimbursementStatus } from '@cashctrl/types';
import { useTranslation } from 'react-i18next';

interface ReimbStatusProps {
  status: ReimbursementStatus;
  onChange: (s: ReimbursementStatus) => void;
}

export function ReimbursementStatusPicker({ status, onChange }: Readonly<ReimbStatusProps>) {
  const { t } = useTranslation('transactions');

  return (
    <div className="border-t border-line-subtle pt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-content-subtle">
          {t('reimbursement_status.label')}
        </p>
        <button
          type="button"
          onClick={() => onChange(status === null ? 'en_attente' : null)}
          className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all ${
            status === null
              ? 'text-content-subtle hover:text-content-secondary hover:bg-surface-muted'
              : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
          }`}
        >
          {status === null ? t('reimbursement_status.activate') : t('reimbursement_status.active')}
        </button>
      </div>
      {status !== null && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange('en_attente')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              status === 'en_attente'
                ? 'bg-warning-surface border-warning/30 text-warning'
                : 'bg-surface-muted border-line text-content-subtle hover:bg-surface-emphasis'
            }`}
          >
            {t('reimbursement_status.pending')}
          </button>
          <button
            type="button"
            onClick={() => onChange('rembourse')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              status === 'rembourse'
                ? 'bg-success-surface border-success/30 text-success'
                : 'bg-surface-muted border-line text-content-subtle hover:bg-surface-emphasis'
            }`}
          >
            {t('reimbursement_status.done')}
          </button>
        </div>
      )}
    </div>
  );
}
