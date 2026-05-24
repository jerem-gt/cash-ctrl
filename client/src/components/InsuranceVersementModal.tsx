import { type SubmitEvent, useState } from 'react';

import { useAccounts } from '@/hooks/useAccounts';
import { useVersement } from '@/hooks/useInsurance';
import { useLogoMap } from '@/hooks/useLogoMap';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

import { AccountSelect } from './AccountSelect';
import { Button, DecimalInput, FormGroup, Input, ModalFrame, showToast } from './ui';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceVersementModal({ accountId, support, onClose }: Readonly<Props>) {
  const [amount, setAmount] = useState('');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today());
  const [sourceAccountId, setSourceAccountId] = useState('');
  const versement = useVersement(accountId);
  const { data: allAccounts = [] } = useAccounts();
  const logoMap = useLogoMap();

  const sourceAccounts = allAccounts.filter(
    (a) => a.envelope_type == null && a.closed_at == null && a.id !== accountId,
  );

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    versement.mutate(
      {
        support_id: support.id,
        amount: Number.parseFloat(amount),
        fees: Number.parseFloat(fees) || 0,
        date,
        source_account_id: sourceAccountId ? Number(sourceAccountId) : null,
      },
      {
        onSuccess: () => {
          showToast('Versement enregistré ✓');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <ModalFrame title={`Versement — ${support.name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormGroup label="Montant versé (€)" htmlFor="vers-amount">
          <DecimalInput
            id="vers-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
        </FormGroup>

        {sourceAccounts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="vers-source"
              className="text-[11px] font-medium uppercase tracking-wider text-stone-400"
            >
              <span>Depuis le compte</span>
              <span className="ml-1 text-stone-300 normal-case tracking-normal font-normal">
                (optionnel)
              </span>
            </label>
            <AccountSelect
              id="vers-source"
              value={sourceAccountId}
              onChange={setSourceAccountId}
              accounts={sourceAccounts}
              logoMap={logoMap}
              placeholder="— Aucun —"
            />
          </div>
        )}

        <div className="flex gap-3">
          <FormGroup label="Frais (€)" htmlFor="vers-fees">
            <DecimalInput id="vers-fees" value={fees} onChange={(e) => setFees(e.target.value)} />
          </FormGroup>
          <FormGroup label="Date" htmlFor="vers-date">
            <Input
              id="vers-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </FormGroup>
        </div>

        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" onClick={onClose} disabled={versement.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" disabled={!amount || versement.isPending}>
            {versement.isPending ? '…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
