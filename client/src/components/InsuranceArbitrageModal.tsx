import { type SubmitEvent, useState } from 'react';

import { useArbitrage } from '@/hooks/useInsurance';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

import { Button, DecimalInput, FormGroup, Input, Select, showToast } from './ui';

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
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today());
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
              <span className="text-[10px] text-stone-400">
                Max :{' '}
                {fromSupport.value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
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
            <FormGroup label="Frais (€)" htmlFor="arb-fees">
              <DecimalInput id="arb-fees" value={fees} onChange={(e) => setFees(e.target.value)} />
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
              disabled={!fromAmount || !toSupportId || arbitrage.isPending}
            >
              {arbitrage.isPending ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
