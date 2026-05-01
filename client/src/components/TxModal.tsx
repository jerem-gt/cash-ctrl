import { type SubmitEvent, useState } from 'react';

import { AccountSelect } from '@/components/AccountSelect';
import { TxCoreFields, type TxCoreState } from '@/components/TxCoreFields';
import { type SplitInput, TxSplitEditor } from '@/components/TxSplitEditor';
import { Button, FormGroup, Input, showToast } from '@/components/ui';
import { useCreateTransaction, useCreateTransfer } from '@/hooks/useTransactions';
import { today } from '@/lib/format';
import type { Account, Category, PaymentMethod, Transaction } from '@/types';

import { ReimbursementsPanel } from './ReimbursementsPanel';

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
  isVentilated: boolean;
  splits: { subcategory_id: number; amount: number }[];
};

type BaseProps = {
  accounts: Account[];
  logoMap: Record<string, string | null>;
  categories: Pick<Category, 'id' | 'name' | 'subcategories'>[];
  paymentMethods: Pick<PaymentMethod, 'id' | 'name' | 'icon'>[];
  fixedAccountId?: number;
  onClose: () => void;
};

type CreateProps = BaseProps & {
  mode: 'create';
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

function getTransferAccounts(tx: Transaction): { from: string; to: string } {
  const isExpense = tx.type === 'expense';
  return {
    from: String(isExpense ? tx.account_id : (tx.transfer_peer_account_id ?? tx.account_id)),
    to: String(isExpense ? (tx.transfer_peer_account_id ?? '') : tx.account_id),
  };
}

function initCore(
  tx: Transaction | null,
  duplicateFrom: Transaction | undefined,
  fixedAccountId: number | undefined,
): TxCoreState {
  // 1. Déterminer la source de données (Priorité : Edition > Duplication > Vide)
  const source = tx ?? duplicateFrom;
  if (!source) return emptyCore(fixedAccountId);

  // 2. Initialisation des valeurs par défaut
  const isTransfer = source.transfer_peer_id !== null;
  const isDuplicate = !tx && !!duplicateFrom;

  // Logique spécifique pour les comptes
  let account_id = String(source.account_id);
  let to_account_id = '';
  if (isTransfer) {
    const accounts = getTransferAccounts(source);
    account_id = accounts.from;
    to_account_id = accounts.to;
  }

  // 3. Retourner l'état consolidé
  return {
    type: isDuplicate && isTransfer ? 'expense' : source.type,
    amount: String(source.amount),
    description: source.description,
    category_id: source.category_id != null ? String(source.category_id) : '',
    subcategory_id: source.subcategory_id != null ? String(source.subcategory_id) : '',
    account_id: fixedAccountId ? String(fixedAccountId) : account_id,
    to_account_id,
    payment_method_id: String(source.payment_method_id),
  };
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

  const fixedAccountId = props.fixedAccountId;
  const duplicateFrom = isEdit ? undefined : (props as CreateProps).duplicateFrom;
  const isDuplicate = duplicateFrom != null;

  const [core, setCore] = useState<TxCoreState>(() => initCore(tx, duplicateFrom, fixedAccountId));
  const [date, setDate] = useState(isEdit ? tx!.date : today);
  const [notes, setNotes] = useState(isEdit ? (tx!.notes ?? '') : (duplicateFrom?.notes ?? ''));
  const [validated, setValidated] = useState(isEdit ? !!tx!.validated : false);
  const [reimbursementStatus, setReimbursementStatus] = useState<'en_attente' | 'rembourse' | null>(
    null,
  );
  const [isTransfer, setIsTransfer] = useState(!!duplicateFrom?.transfer_peer_id);
  const [isVentilated, setIsVentilated] = useState(() => !!(tx ?? duplicateFrom)?.splits?.length);
  const [splits, setSplits] = useState<SplitInput[]>(() => {
    const source = tx ?? duplicateFrom;
    if (!source?.splits?.length) return [];
    return source.splits.map((s) => ({
      _key: String(s.subcategory_id),
      category_id: String(
        categories.find((c) => c.subcategories.some((sub) => sub.id === s.subcategory_id))?.id ??
          '',
      ),
      subcategory_id: String(s.subcategory_id),
      amount: String(s.amount),
    }));
  });

  const validateSplits = (rows: SplitInput[], total: number): string | null => {
    if (rows.length === 0) return 'Ajoutez au moins une ligne de ventilation.';
    for (const s of rows) {
      if (!s.subcategory_id) return 'Chaque ligne doit avoir une sous-catégorie.';
      if (!(Number.parseFloat(s.amount) > 0)) return 'Chaque ligne doit avoir un montant positif.';
    }
    const sum = rows.reduce((acc, s) => acc + Number.parseFloat(s.amount), 0);
    if (Math.abs(sum - total) > 0.01)
      return `Total ventilation (${sum.toFixed(2)} €) ≠ montant (${total.toFixed(2)} €).`;
    return null;
  };

  const createTx = useCreateTransaction();
  const createTransfer = useCreateTransfer();
  const isTransferCreate = !isEdit && isTransfer;
  const noOtherAccounts = fixedAccountId != null && accounts.every((a) => a.id === fixedAccountId);

  const handleModeToggle = (toTransfer: boolean) => {
    setIsTransfer(toTransfer);
    if (toTransfer) {
      setIsVentilated(false);
      setSplits([]);
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
    if (isVentilated) {
      const err = validateSplits(splits, Number.parseFloat(core.amount));
      if (err) {
        showToast(err);
        return;
      }
    }
    if (
      !core.amount ||
      !core.description ||
      (isTransferEdit && (!core.account_id || !core.to_account_id)) ||
      (!isTransferEdit && !core.account_id) ||
      (!isTransferEdit && !isVentilated && !core.subcategory_id) ||
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
      isVentilated,
      splits: splits.map((s) => ({
        subcategory_id: Number.parseInt(s.subcategory_id),
        amount: Number.parseFloat(s.amount),
      })),
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
    if (isVentilated) {
      const err = validateSplits(splits, Number.parseFloat(core.amount));
      if (err) {
        showToast(err);
        return;
      }
    }
    const subcategoryId = isVentilated ? 0 : Number.parseInt(core.subcategory_id);
    const pmId = Number.parseInt(core.payment_method_id);
    if (
      !core.amount ||
      !core.description ||
      !pmId ||
      (fixedAccountId == null && !core.account_id) ||
      (!isVentilated && !subcategoryId)
    ) {
      showToast('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    createTx.mutate(
      {
        type: core.type,
        amount: Number.parseFloat(core.amount),
        description: core.description,
        subcategory_id: isVentilated ? null : subcategoryId,
        splits: isVentilated
          ? splits.map((s) => ({
              subcategory_id: Number.parseInt(s.subcategory_id),
              amount: Number.parseFloat(s.amount),
            }))
          : undefined,
        account_id: fixedAccountId ?? Number.parseInt(core.account_id),
        date,
        payment_method_id: pmId,
        reimbursement_status: core.type === 'expense' ? reimbursementStatus : null,
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
              <>
                <TxCoreFields
                  value={core}
                  onChange={(patch) => setCore((c) => ({ ...c, ...patch }))}
                  accounts={accounts}
                  logoMap={logoMap}
                  categories={categories}
                  paymentMethods={paymentMethods}
                  isTransfer={isTransferCreate}
                  fixedAccountId={fixedAccountId}
                  hideCategories={isVentilated}
                />
                {!isTransferCreate && (
                  <>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setIsVentilated((v) => !v);
                          setSplits([]);
                          setCore((c) => ({ ...c, category_id: '', subcategory_id: '' }));
                        }}
                        className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all ${
                          isVentilated
                            ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        {isVentilated ? '⊕ Ventilée' : 'Ventiler'}
                      </button>
                    </div>
                    {isVentilated && (
                      <TxSplitEditor
                        splits={splits}
                        onChange={setSplits}
                        categories={categories}
                        totalAmount={Number.parseFloat(core.amount) || 0}
                      />
                    )}
                  </>
                )}
              </>
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

            {isEdit && tx!.type === 'expense' && !isTransferEdit && (
              <ReimbursementsPanel tx={tx!} />
            )}

            {!isEdit && !isTransferCreate && core.type === 'expense' && (
              <div className="border-t border-black/[0.07] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
                    Suivi remboursement
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setReimbursementStatus((s) => (s === null ? 'en_attente' : null))
                    }
                    className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all ${
                      reimbursementStatus !== null
                        ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                        : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {reimbursementStatus !== null ? '⚕ Actif' : 'Activer'}
                  </button>
                </div>
                {reimbursementStatus !== null && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReimbursementStatus('en_attente')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        reimbursementStatus === 'en_attente'
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-stone-50 border-black/10 text-stone-400 hover:bg-stone-100'
                      }`}
                    >
                      En attente
                    </button>
                    <button
                      type="button"
                      onClick={() => setReimbursementStatus('rembourse')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        reimbursementStatus === 'rembourse'
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-stone-50 border-black/10 text-stone-400 hover:bg-stone-100'
                      }`}
                    >
                      Remboursement terminé
                    </button>
                  </div>
                )}
              </div>
            )}

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
