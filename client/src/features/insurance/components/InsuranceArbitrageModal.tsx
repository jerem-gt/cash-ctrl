import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  DecimalInput,
  FormGroup,
  Input,
  ModalFrame,
  Select,
  showToast,
} from '@/components/ui';
import { useArbitrage } from '@/features/insurance/hooks/useInsurance';
import { currentLocale, today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

interface Props {
  accountId: number;
  fromSupport: InsuranceSupportView;
  allSupports: InsuranceSupportView[];
  onClose: () => void;
}

export function InsuranceArbitrageModal({
  accountId,
  fromSupport,
  allSupports,
  onClose,
}: Readonly<Props>) {
  const { t } = useTranslation('insurance');
  const { t: tc } = useTranslation('common');
  const destinations = allSupports.filter((s) => s.id !== fromSupport.id);
  const [toSupportId, setToSupportId] = useState(destinations[0]?.id ?? 0);
  const [fromAmount, setFromAmount] = useState('');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today);
  const arbitrage = useArbitrage(accountId);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    arbitrage.mutate(
      {
        from_support_id: fromSupport.id,
        to_support_id: toSupportId,
        from_amount: Number.parseFloat(fromAmount),
        fees: Number.parseFloat(fees) || 0,
        date,
      },
      {
        onSuccess: () => {
          showToast(t('arbitrage_modal.success'));
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  if (destinations.length === 0) {
    return (
      <ModalFrame title={t('arbitrage_modal.title_no_dest')} onClose={onClose}>
        <p className="text-sm text-content-subtle mb-6">{t('arbitrage_modal.no_destinations')}</p>
        <div className="flex justify-end">
          <Button onClick={onClose}>{tc('close')}</Button>
        </div>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame
      title={t('arbitrage_modal.title', { support: fromSupport.name })}
      onClose={arbitrage.isPending ? undefined : onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormGroup label={t('arbitrage_modal.dest_label')} htmlFor="arb-to">
          <Select
            id="arb-to"
            value={toSupportId}
            onChange={(e) => setToSupportId(Number(e.target.value))}
          >
            {destinations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (
                {s.type === 'euro' ? t('arbitrage_modal.euro_type') : t('arbitrage_modal.uc_type')})
              </option>
            ))}
          </Select>
        </FormGroup>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="arb-from-amount"
              className="text-[11px] font-medium uppercase tracking-wider text-content-subtle"
            >
              {t('arbitrage_modal.amount_label')}
            </label>
            <span className="text-[10px] text-content-subtle">
              {t('arbitrage_modal.max_label')}{' '}
              {fromSupport.value.toLocaleString(currentLocale(), {
                style: 'currency',
                currency: 'EUR',
              })}
            </span>
          </div>
          <DecimalInput
            id="arb-from-amount"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <FormGroup label={tc('fees')} htmlFor="arb-fees">
            <DecimalInput id="arb-fees" value={fees} onChange={(e) => setFees(e.target.value)} />
          </FormGroup>
          <FormGroup label={tc('date')} htmlFor="arb-date">
            <Input
              id="arb-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </FormGroup>
        </div>

        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" onClick={onClose} disabled={arbitrage.isPending}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!fromAmount || !toSupportId || arbitrage.isPending}
          >
            {arbitrage.isPending ? tc('loading') : tc('save')}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
