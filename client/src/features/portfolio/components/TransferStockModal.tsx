import { type SyntheticEvent, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { useTransferStock } from '@/features/portfolio/hooks/useStocks';
import { useAccounts } from '@/hooks/useAccounts';
import { today } from '@/lib/format';
import type { StockPosition } from '@/types';

interface Props {
  accountId: number;
  position: StockPosition;
  onClose: () => void;
}

export function TransferStockModal({ accountId, position, onClose }: Readonly<Props>) {
  const { t } = useTranslation('portfolio');
  const { t: tc } = useTranslation('common');
  const { data: allAccounts = [] } = useAccounts();
  const transfer = useTransferStock(accountId);

  const investmentTargets = allAccounts.filter(
    (a) => a.envelope_type === 'investment' && a.id !== accountId && !a.closed_at,
  );

  const [toAccountId, setToAccountId] = useState<number>(() => investmentTargets[0]?.id ?? 0);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(today);

  const qty = Number.parseFloat(quantity) || 0;
  const isValid = toAccountId > 0 && qty > 0 && qty <= position.quantity;

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;
    transfer.mutate(
      { to_account_id: toAccountId, ticker: position.ticker, quantity: qty, date },
      {
        onSuccess: () => {
          showToast(t('transfer_modal.success', { qty, ticker: position.ticker }));
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const pru = position.avg_price.toLocaleString('fr-FR', {
    style: 'currency',
    currency: position.currency ?? 'EUR',
  });

  return (
    <ModalFrame
      title={t('transfer_modal.title')}
      subtitle={
        <Trans
          i18nKey="transfer_modal.subtitle"
          ns="portfolio"
          values={{ ticker: position.ticker, pru }}
          components={{
            ticker: <span className="font-mono font-bold text-stone-700" />,
          }}
        />
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormGroup label={t('transfer_modal.dest_account')} htmlFor="tf-to-account">
          {investmentTargets.length === 0 ? (
            <p className="text-sm text-red-600 py-2">{t('transfer_modal.no_targets')}</p>
          ) : (
            <select
              id="tf-to-account"
              value={toAccountId}
              onChange={(e) => setToAccountId(Number.parseInt(e.target.value, 10))}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
            >
              {investmentTargets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </FormGroup>

        <div className="flex gap-3">
          <FormGroup
            label={t('transfer_modal.quantity_label', { max: position.quantity })}
            htmlFor="tf-quantity"
          >
            <Input
              id="tf-quantity"
              type="number"
              min="0.001"
              max={position.quantity}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={String(position.quantity)}
              autoFocus
            />
          </FormGroup>
          <FormGroup label={tc('date')} htmlFor="tf-date">
            <Input
              id="tf-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormGroup>
        </div>

        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" onClick={onClose} disabled={transfer.isPending}>
            {tc('cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={transfer.isPending || !isValid || investmentTargets.length === 0}
          >
            {transfer.isPending ? tc('loading') : t('transfer_modal.submit')}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
