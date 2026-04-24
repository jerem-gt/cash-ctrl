import { type SubmitEvent, useState } from 'react';

import { AccountSelect } from '@/components/AccountSelect';
import { TxCoreFields, type TxCoreState } from '@/components/TxCoreFields';
import { Button, FormGroup, Input, showToast } from '@/components/ui';
import { useCreateTransaction, useCreateTransfer } from '@/hooks/useTransactions';
import { today } from '@/lib/format';
import type { Account, Category, PaymentMethod, Transaction } from '@/types';

export type TxFormState = {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  category_id: string;
  account_id: string;
  date: string;
  payment_method_id: string;
  notes: string;
  validated: boolean;
};

type BaseProps = {
  accounts: Account[];
  logoMap: Record<string, string | null>;
  categories: Pick<Category, 'id' | 'name'>[];
  paymentMethods: Pick<PaymentMethod, 'id' | 'name' | 'icon'>[];
  onClose: () => void;
};

type CreateProps = BaseProps & { mode: 'create'; fixedAccountId?: number };
type EditProps = BaseProps & {
  mode: 'edit';
  tx: Transaction;
  onSave: (data: TxFormState) => void;
  isPending: boolean;
};

type Props = CreateProps | EditProps;

function emptyCore(fixedAccountId?: number): TxCoreState {
  return {
    type: 'expense',
    amount: '',
    description: '',
    category_id: '',
    account_id: fixedAccountId == null ? '' : String(fixedAccountId),
    to_account_id: '',
    payment_method_id: '',
  };
}

export function TxModal(props: Readonly<Props>) {
  const { accounts, logoMap, categories, paymentMethods, onClose } = props;

  const isEdit = props.mode === 'edit';
  const tx = isEdit ? props.tx : null;
  const isTransferEdit = tx != null && tx.transfer_peer_id !== null;

  const [core, setCore] = useState<TxCoreState>(() =>
    isEdit
      ? {
          type: tx!.type,
          amount: String(tx!.amount),
          description: tx!.description,
          category_id: String(tx!.category_id ?? ''),
          account_id: String(tx!.account_id),
          to_account_id: '',
          payment_method_id: String(tx!.payment_method_id ?? ''),
        }
      : emptyCore((props as CreateProps).fixedAccountId),
  );
  const [date, setDate] = useState(isEdit ? tx!.date : today);
  const [notes, setNotes] = useState(isEdit ? (tx!.notes ?? '') : '');
  const [validated, setValidated] = useState(isEdit ? !!tx!.validated : false);

  const createTx = useCreateTransaction();
  const createTransfer = useCreateTransfer();

  const selectedPm = paymentMethods.find((m) => String(m.id) === core.payment_method_id);
  const isTransferCreate = !isEdit && selectedPm?.name === 'Transfert';
  const fixedAccountId = isEdit ? undefined : (props as CreateProps).fixedAccountId;
  const noOtherAccounts = fixedAccountId != null && accounts.every((a) => a.id === fixedAccountId);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();

    if (isEdit) {
      if (
        !core.amount ||
        !core.description ||
        (!isTransferEdit && !core.account_id) ||
        (!isTransferEdit && !core.payment_method_id)
      ) {
        showToast('Veuillez remplir tous les champs obligatoires.');
        return;
      }
      const data: TxFormState = {
        type: core.type,
        amount: core.amount,
        description: core.description,
        category_id: core.category_id,
        account_id: core.account_id,
        date,
        payment_method_id: core.payment_method_id,
        notes,
        validated,
      };
      props.onSave(data);
      return;
    }

    if (isTransferCreate) {
      if (!core.amount || !core.to_account_id) {
        showToast('Veuillez remplir tous les champs.');
        return;
      }
      const fromId = fixedAccountId ?? Number.parseInt(core.account_id);
      createTransfer.mutate(
        {
          from_account_id: fromId,
          to_account_id: Number.parseInt(core.to_account_id),
          amount: Number.parseFloat(core.amount),
          description: core.description || 'Transfert',
          date,
        },
        {
          onSuccess: () => {
            showToast('Transfert effectué ✓');
            onClose();
          },
          onError: (err) => showToast(err.message),
        },
      );
    } else {
      const categoryId = Number.parseInt(core.category_id) || categories[0]?.id;
      const pmId = Number.parseInt(core.payment_method_id);
      if (
        !core.amount ||
        !core.description ||
        !pmId ||
        (fixedAccountId == null && !core.account_id) ||
        !categoryId
      ) {
        showToast('Veuillez remplir tous les champs obligatoires.');
        return;
      }
      createTx.mutate(
        {
          type: core.type,
          amount: Number.parseFloat(core.amount),
          description: core.description,
          category_id: categoryId,
          account_id: fixedAccountId ?? Number.parseInt(core.account_id),
          date,
          payment_method_id: pmId,
        },
        {
          onSuccess: () => {
            showToast('Transaction ajoutée ✓');
            onClose();
          },
          onError: (err) => showToast(err.message),
        },
      );
    }
  };

  const isPending = isEdit ? props.isPending : createTx.isPending || createTransfer.isPending;

  const title = isEdit
    ? 'Modifier la transaction'
    : isTransferCreate
      ? 'Nouveau transfert'
      : 'Nouvelle transaction';

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl">
        <h3 className="font-serif text-xl mb-1">{title}</h3>
        {isTransferEdit && (
          <p className="text-[11px] text-stone-400 mb-4">
            Transfert — montant, date et description appliqués aux deux legs.
          </p>
        )}
        {!isTransferEdit && <div className="mb-4" />}

        {!isEdit && isTransferCreate && noOtherAccounts ? (
          <p className="text-sm text-stone-400">Vous n&apos;avez pas d&apos;autre compte.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {isTransferEdit ? (
              <div className="flex gap-3 flex-wrap">
                <FormGroup label="Montant (€)">
                  <Input
                    type="number"
                    value={core.amount}
                    onChange={(e) => setCore((c) => ({ ...c, amount: e.target.value }))}
                    placeholder="0,00"
                    min="0"
                    step="0.01"
                  />
                </FormGroup>
                <FormGroup label="Description">
                  <Input
                    type="text"
                    value={core.description}
                    onChange={(e) => setCore((c) => ({ ...c, description: e.target.value }))}
                    placeholder="Ex : Virement"
                  />
                </FormGroup>
                <FormGroup label="Compte">
                  <AccountSelect
                    value={core.account_id}
                    onChange={(v) => setCore((c) => ({ ...c, account_id: v }))}
                    accounts={accounts}
                    logoMap={logoMap}
                  />
                </FormGroup>
              </div>
            ) : (
              <TxCoreFields
                value={core}
                onChange={(patch) => setCore((c) => ({ ...c, ...patch }))}
                accounts={accounts}
                logoMap={logoMap}
                categories={categories}
                paymentMethods={paymentMethods}
                fixedAccountId={fixedAccountId}
              />
            )}

            <div className="flex gap-3 flex-wrap items-end">
              <FormGroup label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </FormGroup>
            </div>

            <FormGroup label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informations complémentaires…"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all resize-none"
              />
            </FormGroup>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={validated}
                onChange={(e) => setValidated(e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm text-stone-700">Transaction validée</span>
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending
                  ? '…'
                  : isEdit
                    ? 'Enregistrer'
                    : isTransferCreate
                      ? 'Transférer'
                      : 'Ajouter'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
