import { type SubmitEvent, useState } from 'react';

import { AccountSelect } from '@/components/AccountSelect';
import { ReimbursementsPanel } from '@/components/ReimbursementsPanel.tsx';
import { ReimbursementStatusPicker } from '@/components/ReimbursementStatusPicker.tsx';
import { TxCoreFields, type TxCoreState } from '@/components/TxCoreFields';
import { type SplitInput, TxSplitEditor } from '@/components/TxSplitEditor';
import { Button, FormGroup, Input, showToast } from '@/components/ui';
import { useCreateTransaction, useCreateTransfer } from '@/hooks/useTransactions';
import { today } from '@/lib/format';
import type { Account, Category, PaymentMethod, ReimbursementStatus, Transaction } from '@/types';

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
  const source = tx ?? duplicateFrom;
  if (!source) return emptyCore(fixedAccountId);

  const isTransfer = source.transfer_peer_id !== null;
  const isDuplicate = !tx && !!duplicateFrom;

  let account_id = String(source.account_id);
  let to_account_id = '';
  if (isTransfer) {
    const accounts = getTransferAccounts(source);
    account_id = accounts.from;
    to_account_id = accounts.to;
  }

  return {
    type: isDuplicate && isTransfer ? 'expense' : source.type,
    amount: String(source.amount),
    description: source.description,
    category_id: source.category_id == null ? '' : String(source.category_id),
    subcategory_id: source.subcategory_id == null ? '' : String(source.subcategory_id),
    account_id:
      fixedAccountId && !(isTransfer && tx !== null) ? String(fixedAccountId) : account_id,
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

// ─── Helpers extraits pour réduire la complexité cognitive de TxModal ─────────

function findCategoryId(
  categories: Pick<Category, 'id' | 'name' | 'subcategories'>[],
  subcategoryId: number,
): string {
  const cat = categories.find((c) => c.subcategories.some((sub) => sub.id === subcategoryId));
  return String(cat?.id ?? '');
}

function initSplits(
  source: Transaction | null | undefined,
  categories: Pick<Category, 'id' | 'name' | 'subcategories'>[],
): SplitInput[] {
  if (!source?.splits?.length) return [];
  return source.splits.map((s) => ({
    _key: String(s.subcategory_id),
    category_id: findCategoryId(categories, s.subcategory_id),
    subcategory_id: String(s.subcategory_id),
    amount: String(s.amount),
  }));
}

function validateSplits(rows: SplitInput[], total: number): string | null {
  if (rows.length === 0) return 'Ajoutez au moins une ligne de ventilation.';
  for (const s of rows) {
    if (!s.subcategory_id) return 'Chaque ligne doit avoir une sous-catégorie.';
    if ((Number.parseFloat(s.amount) || 0) <= 0)
      return 'Chaque ligne doit avoir un montant positif.';
  }
  const sum = rows.reduce((acc, s) => acc + Number.parseFloat(s.amount), 0);
  if (Math.abs(sum - total) > 0.01)
    return `Total ventilation (${sum.toFixed(2)} €) ≠ montant (${total.toFixed(2)} €).`;
  return null;
}

function isEditFormIncomplete(
  core: TxCoreState,
  isTransferEdit: boolean,
  isVentilated: boolean,
): boolean {
  if (!core.amount || !core.description) return true;
  if (isTransferEdit) return !core.account_id || !core.to_account_id;
  return !core.account_id || (!isVentilated && !core.subcategory_id) || !core.payment_method_id;
}

function isTxFormIncomplete(
  core: TxCoreState,
  fixedAccountId: number | undefined,
  isVentilated: boolean,
): boolean {
  if (!core.amount || !core.description) return true;
  if (!Number.parseInt(core.payment_method_id)) return true;
  if (fixedAccountId == null && !core.account_id) return true;
  return !isVentilated && !Number.parseInt(core.subcategory_id);
}

function buildSplitPayload(splits: SplitInput[]): { subcategory_id: number; amount: number }[] {
  return splits.map((s) => ({
    subcategory_id: Number.parseInt(s.subcategory_id),
    amount: Number.parseFloat(s.amount),
  }));
}

interface EditCtx {
  isVentilated: boolean;
  splits: SplitInput[];
  core: TxCoreState;
  isTransferEdit: boolean;
  date: string;
  notes: string;
  validated: boolean;
  onSave: EditProps['onSave'];
}

function runSubmitEdit(ctx: EditCtx): void {
  if (ctx.isVentilated) {
    const err = validateSplits(ctx.splits, Number.parseFloat(ctx.core.amount));
    if (err) {
      showToast(err);
      return;
    }
  }
  if (isEditFormIncomplete(ctx.core, ctx.isTransferEdit, ctx.isVentilated)) {
    showToast('Veuillez remplir tous les champs obligatoires.');
    return;
  }
  ctx.onSave({
    type: ctx.core.type,
    amount: ctx.core.amount,
    description: ctx.core.description,
    subcategory_id: ctx.core.subcategory_id,
    account_id: ctx.core.account_id,
    to_account_id: ctx.core.to_account_id,
    date: ctx.date,
    payment_method_id: ctx.core.payment_method_id,
    notes: ctx.notes,
    validated: ctx.validated,
    isVentilated: ctx.isVentilated,
    splits: buildSplitPayload(ctx.splits),
  });
}

interface TxCtx {
  isVentilated: boolean;
  splits: SplitInput[];
  core: TxCoreState;
  fixedAccountId: number | undefined;
  date: string;
  notes: string;
  validated: boolean;
  reimbursementStatus: ReimbursementStatus;
  createTx: ReturnType<typeof useCreateTransaction>;
  onClose: () => void;
}

function runSubmitTx(ctx: TxCtx): void {
  if (ctx.isVentilated) {
    const err = validateSplits(ctx.splits, Number.parseFloat(ctx.core.amount));
    if (err) {
      showToast(err);
      return;
    }
  }
  if (isTxFormIncomplete(ctx.core, ctx.fixedAccountId, ctx.isVentilated)) {
    showToast('Veuillez remplir tous les champs obligatoires.');
    return;
  }
  ctx.createTx.mutate(
    {
      type: ctx.core.type,
      amount: Number.parseFloat(ctx.core.amount),
      description: ctx.core.description,
      subcategory_id: ctx.isVentilated ? null : Number.parseInt(ctx.core.subcategory_id),
      splits: ctx.isVentilated ? buildSplitPayload(ctx.splits) : undefined,
      account_id: ctx.fixedAccountId ?? Number.parseInt(ctx.core.account_id),
      date: ctx.date,
      payment_method_id: Number.parseInt(ctx.core.payment_method_id),
      reimbursement_status: ctx.core.type === 'expense' ? ctx.reimbursementStatus : null,
      validated: ctx.validated,
    },
    {
      onSuccess: () => {
        showToast('Transaction ajoutée ✓');
        ctx.onClose();
      },
      onError: (err) => showToast(err.message),
    },
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function TxModal(props: Readonly<Props>) {
  const { logoMap, categories, paymentMethods, onClose } = props;
  const accounts = props.accounts.filter(
    (a) => a.envelope_type !== 'life_insurance' && a.envelope_type !== 'per',
  );

  const isEdit = props.mode === 'edit';
  const tx = isEdit ? props.tx : null;
  const isTransferEdit = tx?.transfer_peer_id != null;

  const fixedAccountId = props.fixedAccountId;
  const duplicateFrom = isEdit ? undefined : (props as CreateProps).duplicateFrom;
  const isDuplicate = duplicateFrom != null;

  const [core, setCore] = useState<TxCoreState>(() => initCore(tx, duplicateFrom, fixedAccountId));
  const [date, setDate] = useState(isEdit ? tx!.date : today);
  const [notes, setNotes] = useState(isEdit ? (tx!.notes ?? '') : (duplicateFrom?.notes ?? ''));
  const [validated, setValidated] = useState(isEdit ? !!tx!.validated : false);
  const [reimbursementStatus, setReimbursementStatus] = useState<ReimbursementStatus>(null);
  const [isTransfer, setIsTransfer] = useState(!!duplicateFrom?.transfer_peer_id);
  const [isVentilated, setIsVentilated] = useState(() => !!(tx ?? duplicateFrom)?.splits?.length);
  const [splits, setSplits] = useState<SplitInput[]>(() =>
    initSplits(tx ?? duplicateFrom, categories),
  );

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

  const submitEdit = () =>
    runSubmitEdit({
      isVentilated,
      splits,
      core,
      isTransferEdit,
      date,
      notes,
      validated,
      onSave: (props as EditProps).onSave,
    });

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

  const submitTx = () =>
    runSubmitTx({
      isVentilated,
      splits,
      core,
      fixedAccountId,
      date,
      notes,
      validated,
      reimbursementStatus,
      createTx,
      onClose,
    });

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

  const createPending = createTx.isPending || createTransfer.isPending;
  const isPending = isEdit ? (props as EditProps).isPending : createPending;

  if (!isEdit && isTransfer && noOtherAccounts) {
    return (
      <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl min-h-135">
          <h3 className="font-sans text-xl mb-1">{getTitle(isEdit, isTransfer, isDuplicate)}</h3>
          <TxModalHeader
            isEdit={isEdit}
            isTransferEdit={isTransferEdit}
            isTransfer={isTransfer}
            noOtherAccounts={noOtherAccounts}
            onToggle={handleModeToggle}
          />
          <p className="text-sm text-stone-400">Vous n&apos;avez pas d&apos;autre compte.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl min-h-135">
        <h3 className="font-sans text-xl mb-1">{getTitle(isEdit, isTransfer, isDuplicate)}</h3>

        <TxModalHeader
          isEdit={isEdit}
          isTransferEdit={isTransferEdit}
          isTransfer={isTransfer}
          noOtherAccounts={noOtherAccounts}
          onToggle={handleModeToggle}
        />

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

          {isEdit && tx!.type === 'expense' && !isTransferEdit && <ReimbursementsPanel tx={tx!} />}

          {!isEdit && !isTransferCreate && core.type === 'expense' && (
            <ReimbursementStatusPicker
              status={reimbursementStatus}
              onChange={setReimbursementStatus}
            />
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
      </div>
    </div>
  );
}
