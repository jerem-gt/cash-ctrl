import type { Transaction } from '@cashctrl/types';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { useUpdateStockOperation } from '@/features/portfolio/hooks/useStocks';
import { fmtDec } from '@/lib/format';
import { calculateTotalAmount } from '@/lib/stock.ts';

interface Props {
  tx: Transaction;
  onClose: () => void;
}

export function EditStockOperationModal({ tx, onClose }: Readonly<Props>) {
  const { t } = useTranslation('portfolio');
  const { t: tc } = useTranslation('common');
  const op = tx.stock_operation!;
  const update = useUpdateStockOperation(tx.account_id);

  const [quantity, setQuantity] = useState(String(op.quantity));
  const [price, setPrice] = useState(String(op.price_per_share));
  const [fees, setFees] = useState(String(op.fees));
  const [date, setDate] = useState(op.date);

  const qty = Number.parseFloat(quantity) || 0;
  const pps = Number.parseFloat(price) || 0;
  const f = Number.parseFloat(fees) || 0;

  const totalAmount = calculateTotalAmount(op.type, qty, pps, f);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (qty <= 0 || pps <= 0) return;
    update.mutate(
      {
        operationId: op.id,
        quantity: qty,
        price_per_share: pps,
        fees: f,
        date,
        description: undefined,
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

  const isBuy = op.type === 'buy';

  return (
    <ModalFrame
      title={t('edit_operation_modal.title')}
      onClose={update.isPending ? undefined : onClose}
      subtitle={
        <>
          {isBuy ? t('edit_operation_modal.subtitle_buy') : t('edit_operation_modal.subtitle_sell')}{' '}
          — <span className="font-mono font-bold text-content-secondary">{op.ticker}</span>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-3">
          <FormGroup label={t('edit_operation_modal.quantity_label')} htmlFor="edit-op-quantity">
            <Input
              id="edit-op-quantity"
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
            />
          </FormGroup>
          <FormGroup label={t('edit_operation_modal.price_label')} htmlFor="edit-op-price">
            <DecimalInput
              id="edit-op-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </FormGroup>
        </div>

        <div className="flex gap-3">
          <FormGroup label={t('edit_operation_modal.fees_label')} htmlFor="edit-op-fees">
            <DecimalInput
              id="edit-op-fees"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </FormGroup>
          <FormGroup label={tc('date')} htmlFor="edit-op-date">
            <Input
              id="edit-op-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormGroup>
        </div>

        <div className="bg-surface-muted rounded-xl p-3 border border-line">
          <p className="text-[11px] text-content-subtle uppercase tracking-wider mb-1">
            {isBuy
              ? t('edit_operation_modal.total_label')
              : t('edit_operation_modal.total_received')}
          </p>
          <p className={`font-display text-xl ${totalAmount < 0 ? 'text-danger' : 'text-content'}`}>
            {fmtDec(totalAmount)}
          </p>
        </div>

        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" onClick={onClose} disabled={update.isPending}>
            {tc('cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={update.isPending || qty <= 0 || pps <= 0}
          >
            {update.isPending ? tc('loading') : tc('save')}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
