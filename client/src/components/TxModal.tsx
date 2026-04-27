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
  subcategory_id: string;
  account_id: string;
  to_account_id: string;
  date: string;
  payment_method_id: string;
  notes: string;
  validated: boolean;
};

type BaseProps = {
  accounts: Account[];
  logoMap: Record<string, string | null>;
  categories: Pick<Category, 'id' | 'name' | 'subcategories'>[];
  paymentMethods: Pick<PaymentMethod, 'id' | 'name' | 'icon'>[];
  onClose: () => void;
};

type CreateProps = BaseProps & {
  mode: 'create';
  fixedAccountId?: number;
  duplicateFrom?: Transaction;
};
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
    subcategory_id: '',
    account_id: fixedAccountId == null ? '' : String(fixedAccountId),
    to_account_id: '',
    payment_method_id: '',
  };
}

function resolveTransferAccounts(tx: Transaction): { account_id: string; to_account_id: string } {
  const isExpense = tx.type === 'expense';
  return {
    account_id: isExpense ? String(tx.account_id) : String(tx.transfer_peer_account_id ?? ''),
    to_account_id: isExpense ? String(tx.transfer_peer_account_id ?? '') : String(tx.account_id),
  };
}

function initCore(
  tx: Transaction | null,
  duplicateFrom: Transaction | undefined,
  fixedAccountId: number | undefined,
): TxCoreState {
  if (tx !== null) {
    const isTransferTx = tx.transfer_peer_id !== null;
    const { account_id, to_account_id } = isTransferTx
      ? resolveTransferAccounts(tx)
      : { account_id: String(tx.account_id), to_account_id: '' };
    return {
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description,
      category_id: String(tx.category_id ?? ''),
      subcategory_id: String(tx.subcategory_id ?? ''),
      account_id,
      to_account_id,
      payment_method_id: String(tx.payment_method_id ?? ''),
    };
  }
  if (duplicateFrom) {
    if (duplicateFrom.transfer_peer_id !== null) {
      const fromId =
        duplicateFrom.type === 'expense'
          ? duplicateFrom.account_id
          : (duplicateFrom.transfer_peer_account_id ?? duplicateFrom.account_id);
      const toId =
        duplicateFrom.type === 'expense'
          ? (duplicateFrom.transfer_peer_account_id ?? 0)
          : duplicateFrom.account_id;
      return {
        type: 'expense',
        amount: String(duplicateFrom.amount),
        description: duplicateFrom.description,
        category_id: '',
        subcategory_id: '',
        account_id: String(fromId),
        to_account_id: String(toId),
        payment_method_id: '',
      };
    }
    return {
      type: duplicateFrom.type,
      amount: String(duplicateFrom.amount),
      description: duplicateFrom.description,
      category_id: String(duplicateFrom.category_id ?? ''),
      subcategory_id: String(duplicateFrom.subcategory_id ?? ''),
      account_id:
        fixedAccountId == null ? String(duplicateFrom.account_id) : String(fixedAccountId),
      to_account_id: '',
      payment_method_id: String(duplicateFrom.payment_method_id ?? ''),
    };
  }
  return emptyCore(fixedAccountId);
}

function getTitle(isEdit: boolean, isTransfer: boolean, isDuplicate: boolean): string {
  if (isEdit) return 'Modifier la transaction';
  if (isDuplicate && isTransfer) return 'Dupliquer le transfert';
  if (isDuplicate) return 'Dupliquer la transaction';
  if (isTransfer) return 'Nouveau transfert';
  return 'Nouvelle transaction';
}

function getSubmitLabel(isPending: boolean, isEdit: boolean, isTransferCreate: boolean): string {
  if (isPending) return '…';
  if (isEdit) return 'Enregistrer';
  if (isTransferCreate) return 'Transférer';
  return 'Ajouter';
}

function getTransferTabClass(isTransfer: boolean, noOtherAccounts: boolean): string {
  if (isTransfer) return 'bg-stone-900 text-white';
  if (noOtherAccounts) return 'bg-stone-50 text-stone-300 cursor-not-allowed';
  return 'bg-stone-50 text-stone-400 hover:bg-stone-100';
}

interface HeaderProps {
  isEdit: boolean;
  isTransferEdit: boolean;
  isTransfer: boolean;
  noOtherAccounts: boolean;
  onToggle: (toTransfer: boolean) => void;
}

function TxModalHeader({
  isEdit,
  isTransferEdit,
  isTransfer,
  noOtherAccounts,
  onToggle,
}: Readonly<HeaderProps>) {
  if (isEdit) {
    if (isTransferEdit) {
      return (
        <p className="text-[11px] text-stone-400 mb-4">
          Transfert — montant, date et description appliqués aux deux legs.
        </p>
      );
    }
    return <div className="mb-4" />;
  }
  return (
    <div className="flex rounded-lg border border-black/13 overflow-hidden text-sm mb-4">
      <button
        type="button"
        onClick={() => onToggle(false)}
        className={`flex-1 py-2 font-medium transition-colors ${isTransfer ? 'bg-stone-50 text-stone-400 hover:bg-stone-100' : 'bg-stone-900 text-white'}`}
      >
        Transaction
      </button>
      <button
        type="button"
        onClick={() => onToggle(true)}
        disabled={noOtherAccounts}
        className={`flex-1 py-2 font-medium transition-colors ${getTransferTabClass(isTransfer, noOtherAccounts)}`}
      >
        Transfert
      </button>
    </div>
  );
}

export function TxModal(props: Readonly<Props>) {
  const { accounts, logoMap, categories, paymentMethods, onClose } = props;

  const isEdit = props.mode === 'edit';
  const tx = isEdit ? props.tx : null;
  const isTransferEdit = tx != null && tx.transfer_peer_id !== null;

  const fixedAccountId = isEdit ? undefined : (props as CreateProps).fixedAccountId;
  const duplicateFrom = isEdit ? undefined : (props as CreateProps).duplicateFrom;
  const isDuplicate = duplicateFrom != null;

  const [core, setCore] = useState<TxCoreState>(() => initCore(tx, duplicateFrom, fixedAccountId));
  const [date, setDate] = useState(isEdit ? tx!.date : today);
  const [notes, setNotes] = useState(isEdit ? (tx!.notes ?? '') : (duplicateFrom?.notes ?? ''));
  const [validated, setValidated] = useState(isEdit ? !!tx!.validated : false);
  const [isTransfer, setIsTransfer] = useState(!!duplicateFrom?.transfer_peer_id);

  const createTx = useCreateTransaction();
  const createTransfer = useCreateTransfer();
  const isTransferCreate = !isEdit && isTransfer;
  const noOtherAccounts = fixedAccountId != null && accounts.every((a) => a.id === fixedAccountId);

  const handleModeToggle = (toTransfer: boolean) => {
    setIsTransfer(toTransfer);
    if (toTransfer) {
      const srcId = fixedAccountId ?? Number.parseInt(core.account_id);
      const src = accounts.find((a) => a.id === srcId);
      setCore((c) => ({
        ...c,
        subcategory_id: '',
        payment_method_id: '',
        to_account_id: '',
        description: src ? `${src.name} →` : '',
      }));
    } else {
      setCore((c) => ({ ...c, to_account_id: '', description: '' }));
    }
  };

  const submitEdit = () => {
    if (
      !core.amount ||
      !core.description ||
      (isTransferEdit && (!core.account_id || !core.to_account_id)) ||
      (!isTransferEdit && !core.account_id) ||
      (!isTransferEdit && !core.subcategory_id) ||
      (!isTransferEdit && !core.payment_method_id)
    ) {
      showToast('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    (props as EditProps).onSave({
      type: core.type,
      amount: core.amount,
      description: core.description,
      subcategory_id: core.subcategory_id,
      account_id: core.account_id,
      to_account_id: core.to_account_id,
      date,
      payment_method_id: core.payment_method_id,
      notes,
      validated,
    });
  };

  const submitTransfer = () => {
    if (!core.amount || !core.to_account_id) {
      showToast('Veuillez remplir tous les champs.');
      return;
    }
    createTransfer.mutate(
      {
        from_account_id: fixedAccountId ?? Number.parseInt(core.account_id),
        to_account_id: Number.parseInt(core.to_account_id),
        amount: Number.parseFloat(core.amount),
        description: core.description || 'Transfert',
        date,
        notes: notes || null,
        validated,
      },
      {
        onSuccess: () => {
          showToast('Transfert effectué ✓');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const submitTx = () => {
    const subcategoryId = Number.parseInt(core.subcategory_id);
    const pmId = Number.parseInt(core.payment_method_id);
    if (
      !core.amount ||
      !core.description ||
      !pmId ||
      (fixedAccountId == null && !core.account_id) ||
      !subcategoryId
    ) {
      showToast('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    createTx.mutate(
      {
        type: core.type,
        amount: Number.parseFloat(core.amount),
        description: core.description,
        subcategory_id: subcategoryId,
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
  };

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (isEdit) {
      submitEdit();
      return;
    }
    if (isTransferCreate) {
      submitTransfer();
    } else {
      submitTx();
    }
  };

  const isPending = isEdit ? props.isPending : createTx.isPending || createTransfer.isPending;

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl min-h-[540px]">
        <h3 className="font-serif text-xl mb-1">{getTitle(isEdit, isTransfer, isDuplicate)}</h3>

        <TxModalHeader
          isEdit={isEdit}
          isTransferEdit={isTransferEdit}
          isTransfer={isTransfer}
          noOtherAccounts={noOtherAccounts}
          onToggle={handleModeToggle}
        />

        {!isEdit && isTransfer && noOtherAccounts ? (
          <p className="text-sm text-stone-400">Vous n&apos;avez pas d&apos;autre compte.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {isTransferEdit ? (
              <div className="space-y-3">
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
                </div>
                <div className="flex gap-3 flex-wrap">
                  <FormGroup label="Compte source">
                    <AccountSelect
                      id="source-account-select"
                      value={core.account_id}
                      onChange={(v) => setCore((c) => ({ ...c, account_id: v }))}
                      accounts={accounts}
                      logoMap={logoMap}
                    />
                  </FormGroup>
                  <FormGroup label="Compte destination">
                    <AccountSelect
                      id="dest-account-select"
                      value={core.to_account_id}
                      onChange={(v) => setCore((c) => ({ ...c, to_account_id: v }))}
                      accounts={accounts.filter((a) => String(a.id) !== core.account_id)}
                      logoMap={logoMap}
                      placeholder="— Choisir —"
                    />
                  </FormGroup>
                </div>
              </div>
            ) : (
              <TxCoreFields
                value={core}
                onChange={(patch) => setCore((c) => ({ ...c, ...patch }))}
                accounts={accounts}
                logoMap={logoMap}
                categories={categories}
                paymentMethods={paymentMethods}
                isTransfer={isTransferCreate}
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
                {getSubmitLabel(isPending, isEdit, isTransferCreate)}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
