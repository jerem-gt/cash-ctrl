import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { useInterets } from '@/features/insurance/hooks/useInsurance';
import { currentLocale, today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceInteretsModal({ accountId, support, onClose }: Readonly<Props>) {
  const { t } = useTranslation('insurance');
  const { t: tc } = useTranslation('common');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const interets = useInterets(accountId);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    interets.mutate(
      { support_id: support.id, amount: Number.parseFloat(amount), date },
      {
        onSuccess: () => {
          showToast(t('interets_modal.success'));
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <ModalFrame
      title={t('interets_modal.title', { support: support.name })}
      onClose={interets.isPending ? undefined : onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormGroup label={t('interets_modal.amount_label')} htmlFor="interets-amount">
          <DecimalInput
            id="interets-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
          <p className="text-[10px] text-content-subtle mt-1">
            {t('interets_modal.current_balance')}{' '}
            {support.value.toLocaleString(currentLocale(), { style: 'currency', currency: 'EUR' })}
          </p>
        </FormGroup>

        <FormGroup label={tc('date')} htmlFor="interets-date">
          <Input
            id="interets-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormGroup>

        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" onClick={onClose} disabled={interets.isPending}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={!amount || interets.isPending}>
            {tc('save')}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
