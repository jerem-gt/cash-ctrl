import { useState } from 'react';

import { useArbitrage } from '@/hooks/useInsurance';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

import { Button, FormGroup, Input, Select, showToast } from './ui';

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
  const destinations = allSupports.filter((s) => s.id !== fromSupport.id);
  const [toSupportId, setToSupportId] = useState(destinations[0]?.id ?? 0);
  const [fromAmount, setFromAmount] = useState('');
  const [fromVl, setFromVl] = useState('');
  const [toVl, setToVl] = useState('');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today());
  const arbitrage = useArbitrage(accountId);

  const toSupport = allSupports.find((s) => s.id === toSupportId);
  const fromIsUc = fromSupport.type === 'uc';
  const toIsUc = toSupport?.type === 'uc';

  const fromAmountNum = Number.parseFloat(fromAmount) || 0;
  const fromVlNum = Number.parseFloat(fromVl) || 0;
  const toVlNum = Number.parseFloat(toVl) || 0;

  const fromQty = fromIsUc && fromVlNum > 0 ? fromAmountNum / fromVlNum : null;
  const toQty = toIsUc && toVlNum > 0 ? fromAmountNum / toVlNum : null;

  const maxFromAmount = fromIsUc
    ? fromSupport.quantity != null
      ? fromSupport.quantity * (fromSupport.current_price ?? fromSupport.avg_price ?? 0)
      : undefined
    : (fromSupport.balance ?? undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    arbitrage.mutate(
      {
        from_support_id: fromSupport.id,
        to_support_id: toSupportId,
        from_amount: fromAmountNum,
        from_quantity: fromIsUc ? fromQty : null,
        from_price_per_unit: fromIsUc ? fromVlNum : null,
        to_quantity: toIsUc ? toQty : null,
        to_price_per_unit: toIsUc ? toVlNum : null,
        fees: Number.parseFloat(fees) || 0,
        date,
      },
      {
        onSuccess: () => {
          showToast('Arbitrage enregistré ✓');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  if (destinations.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
          <h3 className="font-sans text-xl mb-5">Arbitrage</h3>
          <p className="text-sm text-stone-400 mb-6">
            Aucun autre support disponible pour l'arbitrage.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Fermer</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-5">Arbitrage depuis {fromSupport.name}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Support destination" htmlFor="arb-to">
            <Select
              id="arb-to"
              value={toSupportId}
              onChange={(e) => setToSupportId(Number(e.target.value))}
            >
              {destinations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type === 'euro' ? 'Fonds euro' : 'UC'})
                </option>
              ))}
            </Select>
          </FormGroup>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="arb-from-amount"
                className="text-[11px] font-medium uppercase tracking-wider text-stone-400"
              >
                Montant arbitré (€)
              </label>
              {maxFromAmount != null && (
                <span className="text-[10px] text-stone-400">
                  Max :{' '}
                  {maxFromAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </span>
              )}
            </div>
            <Input
              id="arb-from-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          {fromIsUc && (
            <FormGroup label="VL source (€ / part)" htmlFor="arb-from-vl">
              <Input
                id="arb-from-vl"
                type="number"
                step="0.000001"
                min="0.000001"
                value={fromVl}
                onChange={(e) => setFromVl(e.target.value)}
                required
              />
              {fromQty != null && fromVlNum > 0 && (
                <p className="text-[10px] text-stone-400 mt-1">
                  ≈ {fromQty.toFixed(6)} parts vendues
                </p>
              )}
            </FormGroup>
          )}

          {toIsUc && (
            <FormGroup label="VL destination (€ / part)" htmlFor="arb-to-vl">
              <Input
                id="arb-to-vl"
                type="number"
                step="0.000001"
                min="0.000001"
                value={toVl}
                onChange={(e) => setToVl(e.target.value)}
                required
              />
              {toQty != null && toVlNum > 0 && (
                <p className="text-[10px] text-stone-400 mt-1">
                  ≈ {toQty.toFixed(6)} parts achetées
                </p>
              )}
            </FormGroup>
          )}

          <div className="flex gap-3">
            <FormGroup label="Frais (€)" htmlFor="arb-fees">
              <Input
                id="arb-fees"
                type="number"
                step="0.01"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Date" htmlFor="arb-date">
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
              Annuler
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={
                !fromAmount ||
                !toSupportId ||
                (fromIsUc && !fromVl) ||
                (toIsUc && !toVl) ||
                arbitrage.isPending
              }
            >
              {arbitrage.isPending ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
