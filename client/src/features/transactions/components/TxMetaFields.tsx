import type { ScheduledTransaction } from '@cashctrl/types';
import { useTranslation } from 'react-i18next';

import { FormGroup, Input } from '@/components/ui';

interface Props {
  date: string;
  onDateChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  validated: boolean;
  onValidatedChange: (v: boolean) => void;
  schedulingOptions: ScheduledTransaction[];
  scheduledId: number | null;
  onScheduledChange: (id: number | null) => void;
}

export function TxMetaFields({
  date,
  onDateChange,
  notes,
  onNotesChange,
  validated,
  onValidatedChange,
  schedulingOptions,
  scheduledId,
  onScheduledChange,
}: Readonly<Props>) {
  const { t } = useTranslation('transactions');
  const { t: tc } = useTranslation('common');

  return (
    <>
      <div className="flex gap-3 flex-wrap items-end">
        <FormGroup label={tc('date')}>
          <Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
        </FormGroup>
      </div>

      <FormGroup label={t('modal.notes_label')}>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={t('modal.notes_placeholder')}
          rows={2}
          className="w-full px-3 py-2 text-sm bg-surface-muted border border-line rounded-lg outline-none focus:border-brand-500 transition-all resize-none"
        />
      </FormGroup>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={validated}
          onChange={(e) => onValidatedChange(e.target.checked)}
          className="w-4 h-4 accent-brand-500"
        />
        <span className="text-sm text-content-secondary">{t('modal.validated_label')}</span>
      </label>

      {schedulingOptions.length > 0 && (
        <FormGroup label={t('modal.scheduling_label')} htmlFor="scheduled-select">
          <select
            id="scheduled-select"
            value={scheduledId ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onScheduledChange(val === '' ? null : Number.parseInt(val));
            }}
            className="w-full px-3 py-2 text-sm bg-surface-muted border border-line rounded-lg outline-none focus:border-brand-500 transition-all"
          >
            <option value="">{t('modal.no_scheduling')}</option>
            {schedulingOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.description}
              </option>
            ))}
          </select>
        </FormGroup>
      )}
    </>
  );
}
