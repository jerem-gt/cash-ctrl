import { type SubmitEvent, useState } from 'react';

import { useRevalorisation } from '@/hooks/useInsurance';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

import { Button, FormGroup, Input, showToast } from './ui';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceRevalorisationModal({ accountId, support, onClose }: Readonly<Props>) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const revalorisation = useRevalorisation(accountId);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    revalorisation.mutate(
      {
        support_id: support.id,
        amount: Number.parseFloat(amount),
        date,
      },
      {
        onSuccess: () => {
          showToast('Revalorisation enregistrée ✓');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-1">Revalorisation — {support.name}</h3>
        <p className="text-[11px] text-stone-400 mb-5">
          Valeur actuelle :{' '}
          {support.value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reval-amount"
              className="text-[11px] font-medium uppercase tracking-wider text-stone-400"
            >
              Plus/moins-value (€)
            </label>
            <Input
              id="reval-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
            <p className="text-[10px] text-stone-400">
              Positif = gain, négatif = perte (frais inclus)
            </p>
          </div>

          <FormGroup label="Date" htmlFor="reval-date">
            <Input
              id="reval-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </FormGroup>

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={revalorisation.isPending}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={!amount || revalorisation.isPending}>
              {revalorisation.isPending ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
