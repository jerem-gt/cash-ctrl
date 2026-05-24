import { type SubmitEvent, useState } from 'react';

import { Button, DecimalInput, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { useInterets } from '@/features/insurance/hooks/useInsurance';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

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
    <ModalFrame title={`Intérêts — ${support.name}`}>
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
    </ModalFrame>
  );
}
