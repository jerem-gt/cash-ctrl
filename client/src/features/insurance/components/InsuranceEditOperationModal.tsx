import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { useUpdateInsuranceOperation } from '@/features/insurance/hooks/useInsurance';
import type { InsuranceOperation } from '@/types';

interface Props {
  accountId: number;
  op: InsuranceOperation;
  onClose: () => void;
}

export function InsuranceEditOperationModal({ accountId, op, onClose }: Readonly<Props>) {
  const { t } = useTranslation('insurance');
  const { t: tc } = useTranslation('common');
  const [amount, setAmount] = useState(op.amount.toFixed(2));
  const [fees, setFees] = useState(op.fees.toFixed(2));
  const [socialFees, setSocialFees] = useState(op.social_fees.toFixed(2));
  const [date, setDate] = useState(op.date);
  const update = useUpdateInsuranceOperation(accountId);

  const isArbitrage = op.type === 'arbitrage_in' || op.type === 'arbitrage_out';
  const hasFees = op.type === 'versement' || op.type === 'rachat';
  const hasSocialFees = op.type === 'rachat';
  const allowNegative = op.type === 'revalorisation';

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    update.mutate(
      {
        operationId: op.id,
        amount: Number.parseFloat(amount),
        fees: hasFees ? Number.parseFloat(fees) || 0 : 0,
        social_fees: hasSocialFees ? Number.parseFloat(socialFees) || 0 : 0,
        date,
      },
      {
        onSuccess: () => {
          showToast(t('edit_operation_modal.success'));
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const opLabels: Record<InsuranceOperation['type'], string> = {
    versement: t('edit_operation_modal.op_versement'),
    rachat: t('edit_operation_modal.op_rachat'),
    arbitrage_in: t('edit_operation_modal.op_arbitrage_in'),
    arbitrage_out: t('edit_operation_modal.op_arbitrage_out'),
    interets: t('edit_operation_modal.op_interets'),
    revalorisation: t('edit_operation_modal.op_revalorisation'),
  };

  return (
    <ModalFrame
      title={t('edit_operation_modal.title')}
      subtitle={`${opLabels[op.type]} — ${op.support_name}`}
      onClose={update.isPending ? undefined : onClose}
    >
      {isArbitrage ? (
        <>
          <p className="text-sm text-stone-500 mb-6">
            {t('edit_operation_modal.arbitrage_readonly')}
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>{tc('close')}</Button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label={t('edit_operation_modal.amount_label')} htmlFor="edit-op-amount">
            <DecimalInput
              id="edit-op-amount"
              allowNegative={allowNegative}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </FormGroup>

          <div className="flex gap-3 items-end">
            {hasFees && (
              <FormGroup label={t('edit_operation_modal.fees_label')} htmlFor="edit-op-fees">
                <DecimalInput
                  id="edit-op-fees"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                />
              </FormGroup>
            )}
            {hasSocialFees && (
              <FormGroup
                label={t('edit_operation_modal.social_fees_label')}
                htmlFor="edit-op-social-fees"
              >
                <DecimalInput
                  id="edit-op-social-fees"
                  value={socialFees}
                  onChange={(e) => setSocialFees(e.target.value)}
                />
              </FormGroup>
            )}
            <FormGroup label={tc('date')} htmlFor="edit-op-date" className="min-w-36">
              <Input
                id="edit-op-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </FormGroup>
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={update.isPending}>
              {tc('cancel')}
            </Button>
            <Button variant="primary" type="submit" disabled={!amount || update.isPending}>
              {update.isPending ? tc('loading') : tc('save')}
            </Button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}
