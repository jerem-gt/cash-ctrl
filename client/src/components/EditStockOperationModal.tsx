import { type SyntheticEvent, useState } from 'react';

import { Button, FormGroup, Input, showToast } from '@/components/ui';
import { useUpdateStockOperation } from '@/hooks/useStocks';
import { calculateTotalAmount } from '@/lib/stock.ts';
import type { Transaction } from '@/types';

interface Props {
  tx: Transaction;
  onClose: () => void;
}

export function EditStockOperationModal({ tx, onClose }: Readonly<Props>) {
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

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
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
          showToast('Opération modifiée ✓');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const isBuy = op.type === 'buy';

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-1">Modifier l&apos;opération</h3>
        <p className="text-[11px] text-stone-400 mb-5">
          {isBuy ? 'Achat' : 'Vente'} —{' '}
          <span className="font-mono font-bold text-stone-600">{op.ticker}</span>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <FormGroup label="Nombre d'actions" htmlFor="edit-op-quantity">
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
            <FormGroup label="Prix unitaire (€)" htmlFor="edit-op-price">
              <Input
                id="edit-op-price"
                type="number"
                min="0.0001"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </FormGroup>
          </div>

          <div className="flex gap-3">
            <FormGroup label="Frais (€)" htmlFor="edit-op-fees">
              <Input
                id="edit-op-fees"
                type="number"
                min="0"
                step="any"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Date" htmlFor="edit-op-date">
              <Input
                id="edit-op-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </FormGroup>
          </div>

          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
            <p className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">
              {isBuy ? 'Montant total' : 'Montant net reçu'}
            </p>
            <p
              className={`font-sans text-xl ${totalAmount < 0 ? 'text-red-700' : 'text-stone-900'}`}
            >
              {totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={update.isPending}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={update.isPending || qty <= 0 || pps <= 0}
            >
              {update.isPending ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
