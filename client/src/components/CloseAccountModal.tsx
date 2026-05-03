import { useState } from 'react';

import { Button, FormGroup, Input, Select, showToast } from '@/components/ui';
import { useCloseAccount } from '@/hooks/useAccounts';
import { fmtDec, today } from '@/lib/format';
import type { Account } from '@/types';

interface Props {
  account: Account;
  activeAccounts: Account[];
  onClose: () => void;
}

export function CloseAccountModal({ account, activeAccounts, onClose }: Readonly<Props>) {
  const balance = Math.round(account.balance * 100) / 100;
  const needsTransfer = balance !== 0;

  const [closedAt, setClosedAt] = useState(today());
  const [transferToId, setTransferToId] = useState('');

  const closeAccount = useCloseAccount();

  const transferTargets = activeAccounts.filter((a) => a.id !== account.id);

  const handleSubmit = () => {
    if (needsTransfer && !transferToId) {
      showToast('Choisissez un compte de destination.');
      return;
    }
    if (!closedAt) {
      showToast('Renseignez la date de clôture.');
      return;
    }
    closeAccount.mutate(
      {
        id: account.id,
        closed_at: closedAt,
        ...(needsTransfer ? { transfer_to_account_id: Number.parseInt(transferToId) } : {}),
      },
      {
        onSuccess: () => {
          showToast('Compte clôturé ✓');
          onClose();
        },
        onError: (e) => showToast(e.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-serif text-xl mb-1">Clôturer le compte</h3>
        <p className="text-sm text-stone-400 mb-5">{account.name}</p>

        {needsTransfer ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
            Ce compte a un solde de <span className="font-semibold">{fmtDec(balance)}</span>. Un
            virement de clôture sera créé automatiquement.
          </div>
        ) : (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-5 text-sm text-stone-600">
            Le solde est nul, la clôture peut être effectuée directement.
          </div>
        )}

        <div className="space-y-3">
          {needsTransfer && (
            <FormGroup label="Virer le solde vers">
              <Select value={transferToId} onChange={(e) => setTransferToId(e.target.value)}>
                <option value="">— Choisir un compte —</option>
                {transferTargets.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                    {a.bank ? ` (${a.bank})` : ''}
                  </option>
                ))}
              </Select>
            </FormGroup>
          )}
          <FormGroup label="Date de clôture">
            <Input type="date" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} />
          </FormGroup>
        </div>

        <div className="flex gap-2 justify-end pt-5">
          <Button type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleSubmit}
            disabled={closeAccount.isPending}
          >
            {closeAccount.isPending ? '…' : 'Clôturer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
