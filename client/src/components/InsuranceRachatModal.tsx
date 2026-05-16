import { type SubmitEvent, useMemo, useState } from 'react';

import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
import { useRachat } from '@/hooks/useInsurance';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

import { AccountSelect } from './AccountSelect';
import { Button, FormGroup, Input, showToast } from './ui';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceRachatModal({ accountId, support, onClose }: Readonly<Props>) {
  const [amount, setAmount] = useState('');
  const [fees, setFees] = useState('0');
  const [socialFees, setSocialFees] = useState('0');
  const [date, setDate] = useState(today());
  const [destAccountId, setDestAccountId] = useState('');
  const rachat = useRachat(accountId);
  const { data: allAccounts = [] } = useAccounts();
  const { data: banks = [] } = useBanks();

  const destAccounts = allAccounts.filter(
    (a) => a.envelope_type == null && a.closed_at == null && a.id !== accountId,
  );
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    rachat.mutate(
      {
        support_id: support.id,
        amount: Number.parseFloat(amount),
        fees: Number.parseFloat(fees) || 0,
        social_fees: Number.parseFloat(socialFees) || 0,
        date,
        dest_account_id: destAccountId ? Number(destAccountId) : null,
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
              <span className="text-[10px] text-stone-400">
                Max :{' '}
                {support.value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </span>
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

          {destAccounts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="rachat-dest"
                className="text-[11px] font-medium uppercase tracking-wider text-stone-400"
              >
                <span>Vers le compte</span>
                <span className="ml-1 text-stone-300 normal-case tracking-normal font-normal">
                  (optionnel)
                </span>
              </label>
              <AccountSelect
                id="rachat-dest"
                value={destAccountId}
                onChange={setDestAccountId}
                accounts={destAccounts}
                logoMap={logoMap}
                placeholder="— Aucun —"
              />
            </div>
          )}

          <div className="flex gap-3 items-end">
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
            <FormGroup label="Prélèvements sociaux (€)" htmlFor="rachat-social-fees">
              <Input
                id="rachat-social-fees"
                type="number"
                step="0.01"
                min="0"
                value={socialFees}
                onChange={(e) => setSocialFees(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Date" htmlFor="rachat-date" className="min-w-36">
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
            <Button variant="primary" type="submit" disabled={!amount || rachat.isPending}>
              {rachat.isPending ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
