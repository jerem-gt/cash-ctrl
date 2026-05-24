import { type SyntheticEvent, useState } from 'react';

import { Button, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransferStock } from '@/hooks/useStocks';
import { today } from '@/lib/format';
import type { StockPosition } from '@/types';

interface Props {
  accountId: number;
  position: StockPosition;
  onClose: () => void;
}

export function TransferStockModal({ accountId, position, onClose }: Readonly<Props>) {
  const { data: allAccounts = [] } = useAccounts();
  const transfer = useTransferStock(accountId);

  const investmentTargets = allAccounts.filter(
    (a) => a.envelope_type === 'investment' && a.id !== accountId && !a.closed_at,
  );

  const [toAccountId, setToAccountId] = useState<number>(investmentTargets[0]?.id ?? 0);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(today());

  const qty = Number.parseFloat(quantity) || 0;
  const isValid = toAccountId > 0 && qty > 0 && qty <= position.quantity;

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;
    transfer.mutate(
      { to_account_id: toAccountId, ticker: position.ticker, quantity: qty, date },
      {
        onSuccess: () => {
          showToast(`Transfert de ${qty} × ${position.ticker} enregistré ✓`);
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <ModalFrame
      title="Transférer des titres"
      subtitle={
        <>
          <span className="font-mono font-bold text-stone-700">{position.ticker}</span> — PRU&nbsp;
          {position.avg_price.toLocaleString('fr-FR', {
            style: 'currency',
            currency: position.currency ?? 'EUR',
          })}{' '}
          conservé
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormGroup label="Compte destination" htmlFor="tf-to-account">
          {investmentTargets.length === 0 ? (
            <p className="text-sm text-red-600 py-2">
              Aucun autre compte d'investissement disponible.
            </p>
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
          <FormGroup label={`Nombre d'actions (max ${position.quantity})`} htmlFor="tf-quantity">
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
          <FormGroup label="Date" htmlFor="tf-date">
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
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={transfer.isPending || !isValid || investmentTargets.length === 0}
          >
            {transfer.isPending ? '…' : 'Transférer'}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
