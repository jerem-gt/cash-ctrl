import { useState, type SubmitEvent } from 'react';
import { useCreateTransaction, useCreateTransfer } from '@/hooks/useTransactions';
import { Card, CardTitle, Button, FormGroup, Input, showToast } from '@/components/ui';
import { TxCoreFields, type TxCoreState } from '@/components/TxCoreFields';
import { today } from '@/lib/format';
import type { Account, Category, PaymentMethod } from '@/types';

interface Props {
  accounts: Account[];
  logoMap: Record<string, string | null>;
  categories: Pick<Category, 'id' | 'name'>[];
  paymentMethods: Pick<PaymentMethod, 'id' | 'name' | 'icon'>[];
  /** Si fourni, masque le sélecteur de compte source et épingle ce compte. */
  fixedAccountId?: number;
}

function emptyCore(fixedAccountId?: number): TxCoreState {
  return {
    type: 'expense',
    amount: '',
    description: '',
    category: '',
    account_id: fixedAccountId != null ? String(fixedAccountId) : '',
    to_account_id: '',
    payment_method: '',
  };
}

export function AddTxForm({ accounts, logoMap, categories, paymentMethods, fixedAccountId }: Readonly<Props>) {
  const createTx = useCreateTransaction();
  const createTransfer = useCreateTransfer();

  const [core, setCore] = useState<TxCoreState>(() => emptyCore(fixedAccountId));
  const [date, setDate] = useState(today);

  const isTransfer = core.payment_method === 'Transfert';
  const noOtherAccounts = fixedAccountId != null && accounts.every(a => a.id === fixedAccountId);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();

    if (isTransfer) {
      if (!core.amount || !core.to_account_id) {
        showToast('Veuillez remplir tous les champs.');
        return;
      }
      const fromId = fixedAccountId ?? Number.parseInt(core.account_id);
      createTransfer.mutate({
        from_account_id: fromId,
        to_account_id: Number.parseInt(core.to_account_id),
        amount: Number.parseFloat(core.amount),
        description: core.description || 'Transfert',
        date,
      }, {
        onSuccess: () => {
          setCore(c => ({ ...c, amount: '', description: '', to_account_id: '' }));
          showToast('Transfert effectué ✓');
        },
        onError: err => showToast(err.message),
      });
    } else {
      if (!core.amount || !core.description || !core.payment_method || (fixedAccountId == null && !core.account_id)) {
        showToast('Veuillez remplir tous les champs obligatoires.');
        return;
      }
      createTx.mutate({
        type: core.type,
        amount: Number.parseFloat(core.amount),
        description: core.description,
        category: core.category || categories[0]?.name || 'Autre',
        account_id: fixedAccountId ?? Number.parseInt(core.account_id),
        date,
        payment_method: core.payment_method,
      }, {
        onSuccess: () => {
          setCore(c => ({ ...c, amount: '', description: '' }));
          showToast('Transaction ajoutée ✓');
        },
        onError: err => showToast(err.message),
      });
    }
  };

  const isPending = createTx.isPending || createTransfer.isPending;

  return (
    <Card>
      <CardTitle>{isTransfer ? 'Transfert vers un autre compte' : 'Nouvelle transaction'}</CardTitle>
      {isTransfer && noOtherAccounts ? (
        <p className="text-sm text-stone-400">Vous n&apos;avez pas d&apos;autre compte.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <TxCoreFields
            value={core}
            onChange={patch => setCore(c => ({ ...c, ...patch }))}
            accounts={accounts}
            logoMap={logoMap}
            categories={categories}
            paymentMethods={paymentMethods}
            fixedAccountId={fixedAccountId}
          />
          <div className="flex gap-3 flex-wrap items-end">
            <FormGroup label="Date">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </FormGroup>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? '…' : isTransfer ? 'Transférer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
