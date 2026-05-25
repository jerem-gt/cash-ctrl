import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { useRevalorisation } from '@/features/insurance/hooks/useInsurance';
import { fmtDec, today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceRevalorisationModal({ accountId, support, onClose }: Readonly<Props>) {
  const { t } = useTranslation('insurance');
  const { t: tc } = useTranslation('common');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const revalorisation = useRevalorisation(accountId);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    revalorisation.mutate(
      {
        support_id: support.id,
        amount: Number.parseFloat(amount),
        date,
      },
      {
        onSuccess: () => {
          showToast(t('revalorisation_modal.success'));
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <ModalFrame
      title={t('revalorisation_modal.title', { support: support.name })}
      subtitle={t('revalorisation_modal.subtitle', { value: fmtDec(support.value) })}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="reval-amount"
            className="text-[11px] font-medium uppercase tracking-wider text-stone-400"
          >
            {t('revalorisation_modal.amount_label')}
          </label>
          <DecimalInput
            id="reval-amount"
            allowNegative
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
          <p className="text-[10px] text-stone-400">{t('revalorisation_modal.amount_hint')}</p>
        </div>

        <FormGroup label={tc('date')} htmlFor="reval-date">
          <Input
            id="reval-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormGroup>

        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" onClick={onClose} disabled={revalorisation.isPending}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={!amount || revalorisation.isPending}>
            {revalorisation.isPending ? tc('loading') : tc('save')}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
