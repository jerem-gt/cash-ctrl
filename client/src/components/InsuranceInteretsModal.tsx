import { type SubmitEvent, useState } from 'react';

import { useInterets } from '@/hooks/useInsurance';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

import { Button, DecimalInput, FormGroup, Input, showToast } from './ui';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceInteretsModal({ accountId, support, onClose }: Readonly<Props>) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const interets = useInterets(accountId);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    interets.mutate(
      { support_id: support.id, amount: Number.parseFloat(amount), date },
      {
        onSuccess: () => {
          showToast('Intérêts enregistrés ✓');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-5">Intérêts — {support.name}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Montant des intérêts (€)" htmlFor="interets-amount">
            <DecimalInput
              id="interets-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Solde actuel :{' '}
              {support.value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
          </FormGroup>

          <FormGroup label="Date" htmlFor="interets-date">
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
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={!amount || interets.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
