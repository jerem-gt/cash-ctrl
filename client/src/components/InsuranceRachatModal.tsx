import { useState } from 'react';

import { useRachat } from '@/hooks/useInsurance';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

import { Button, FormGroup, Input, showToast } from './ui';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceRachatModal({ accountId, support, onClose }: Readonly<Props>) {
  const [amount, setAmount] = useState('');
  const [vl, setVl] = useState('');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today());
  const rachat = useRachat(accountId);

  const isUc = support.type === 'uc';
  const amountNum = Number.parseFloat(amount) || 0;
  const vlNum = Number.parseFloat(vl) || 0;
  const quantity = isUc && vlNum > 0 ? amountNum / vlNum : null;

  let maxAmount: number | undefined;
  if (!isUc) {
    maxAmount = support.balance ?? undefined;
  } else if (support.quantity != null) {
    maxAmount = support.quantity * (support.current_price ?? support.avg_price ?? 0);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    rachat.mutate(
      {
        support_id: support.id,
        amount: amountNum,
        quantity: isUc ? quantity : null,
        price_per_unit: isUc ? vlNum : null,
        fees: Number.parseFloat(fees) || 0,
        date,
      },
      {
        onSuccess: () => {
          showToast('Rachat enregistré ✓');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-5">Rachat — {support.name}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="rachat-amount"
                className="text-[11px] font-medium uppercase tracking-wider text-stone-400"
              >
                Montant racheté (€)
              </label>
              {maxAmount != null && (
                <span className="text-[10px] text-stone-400">
                  Max : {maxAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </span>
              )}
            </div>
            <Input
              id="rachat-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          {isUc && (
            <FormGroup label="VL (€ / part)" htmlFor="rachat-vl">
              <Input
                id="rachat-vl"
                type="number"
                step="0.000001"
                min="0.000001"
                value={vl}
                onChange={(e) => setVl(e.target.value)}
                required
              />
              {quantity != null && vlNum > 0 && (
                <p className="text-[10px] text-stone-400 mt-1">
                  ≈ {quantity.toFixed(6)} parts vendues
                </p>
              )}
            </FormGroup>
          )}

          <div className="flex gap-3">
            <FormGroup label="Frais (€)" htmlFor="rachat-fees">
              <Input
                id="rachat-fees"
                type="number"
                step="0.01"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Date" htmlFor="rachat-date">
              <Input
                id="rachat-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </FormGroup>
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={rachat.isPending}>
              Annuler
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!amount || (isUc && !vl) || rachat.isPending}
            >
              {rachat.isPending ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
