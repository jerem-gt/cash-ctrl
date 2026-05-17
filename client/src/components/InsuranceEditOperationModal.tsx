import { type SubmitEvent, useState } from 'react';

import { useUpdateInsuranceOperation } from '@/hooks/useInsurance';
import type { InsuranceOperation } from '@/types';

import { Button, FormGroup, Input, showToast } from './ui';

const OP_LABELS: Record<InsuranceOperation['type'], string> = {
  versement: 'Versement',
  rachat: 'Rachat',
  arbitrage_in: 'Arbitrage ←',
  arbitrage_out: 'Arbitrage →',
  interets: 'Intérêts',
  revalorisation: 'Revalorisation',
};

interface Props {
  accountId: number;
  op: InsuranceOperation;
  onClose: () => void;
}

export function InsuranceEditOperationModal({ accountId, op, onClose }: Readonly<Props>) {
  const [amount, setAmount] = useState(op.amount.toFixed(2));
  const [fees, setFees] = useState(op.fees.toFixed(2));
  const [socialFees, setSocialFees] = useState(op.social_fees.toFixed(2));
  const [date, setDate] = useState(op.date);
  const update = useUpdateInsuranceOperation(accountId);

  const isArbitrage = op.type === 'arbitrage_in' || op.type === 'arbitrage_out';
  const hasFees = op.type === 'versement' || op.type === 'rachat';
  const hasSocialFees = op.type === 'rachat';

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    update.mutate(
      {
        operationId: op.id,
        amount: Number.parseFloat(amount),
        fees: hasFees ? Number.parseFloat(fees) || 0 : 0,
        social_fees: hasSocialFees ? Number.parseFloat(socialFees) || 0 : 0,
        date,
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

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-1">Modifier l'opération</h3>
        <p className="text-sm text-stone-400 mb-5">
          {OP_LABELS[op.type]} — {op.support_name}
        </p>

        {isArbitrage ? (
          <>
            <p className="text-sm text-stone-500 mb-6">
              Les arbitrages ne peuvent pas être modifiés. Supprimez l'opération et recréez-la si
              nécessaire.
            </p>
            <div className="flex justify-end">
              <Button onClick={onClose}>Fermer</Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormGroup label="Montant (€)" htmlFor="edit-op-amount">
              <Input
                id="edit-op-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </FormGroup>

            <div className="flex gap-3 items-end">
              {hasFees && (
                <FormGroup label="Frais (€)" htmlFor="edit-op-fees">
                  <Input
                    id="edit-op-fees"
                    type="text"
                    inputMode="decimal"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                  />
                </FormGroup>
              )}
              {hasSocialFees && (
                <FormGroup label="Prélèvements sociaux (€)" htmlFor="edit-op-social-fees">
                  <Input
                    id="edit-op-social-fees"
                    type="text"
                    inputMode="decimal"
                    value={socialFees}
                    onChange={(e) => setSocialFees(e.target.value)}
                  />
                </FormGroup>
              )}
              <FormGroup label="Date" htmlFor="edit-op-date" className="min-w-36">
                <Input
                  id="edit-op-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </FormGroup>
            </div>

            <div className="flex gap-2 justify-end mt-1">
              <Button type="button" onClick={onClose} disabled={update.isPending}>
                Annuler
              </Button>
              <Button variant="primary" type="submit" disabled={!amount || update.isPending}>
                {update.isPending ? '…' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
