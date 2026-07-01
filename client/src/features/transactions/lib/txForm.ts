import type {
  Account,
  Category,
  ReimbursementStatus,
  ScheduledTransaction,
  Transaction,
} from '@cashctrl/types';
import { type TFunction } from 'i18next';

import { showToast } from '@/components/ui';
import { type TxCoreState } from '@/features/transactions/components/TxCoreFields';
import { type SplitInput } from '@/features/transactions/components/TxSplitEditor';
import { useCreateTransaction, useCreateTransfer } from '@/hooks/useTransactions';

export type TTx = TFunction<'transactions'>;
export type TCommon = TFunction<'common'>;

export type TxFormState = {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  subcategory_id: string;
  account_id: string;
  to_account_id: string;
  date: string;
  payment_method_id: string;
  notes: string | null;
  validated: boolean;
  isVentilated: boolean;
  splits: { subcategory_id: number; amount: number }[];
  scheduled_id: number | null;
};

// ─── Init core/splits ────────────────────────────────────────────────────────

export function emptyCore(fixedAccountId?: number): TxCoreState {
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

export function getTransferAccounts(tx: Transaction): { from: string; to: string } {
  const isExpense = tx.type === 'expense';
  return {
    from: String(isExpense ? tx.account_id : (tx.transfer_peer_account_id ?? tx.account_id)),
    to: String(isExpense ? (tx.transfer_peer_account_id ?? '') : tx.account_id),
  };
}

export function initCore(
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
    amount: source.amount.toFixed(2),
    description: source.description,
    category_id: source.category_id == null ? '' : String(source.category_id),
    subcategory_id: source.subcategory_id == null ? '' : String(source.subcategory_id),
    account_id:
      fixedAccountId && !(isTransfer && tx !== null) ? String(fixedAccountId) : account_id,
    to_account_id,
    payment_method_id: source.payment_method_id == null ? '' : String(source.payment_method_id),
  };
}

export function findCategoryId(
  categories: Pick<Category, 'id' | 'name' | 'subcategories'>[],
  subcategoryId: number,
): string {
  const cat = categories.find((c) => c.subcategories.some((sub) => sub.id === subcategoryId));
  return String(cat?.id ?? '');
}

export function initSplits(
  source: Transaction | null | undefined,
  categories: Pick<Category, 'id' | 'name' | 'subcategories'>[],
): SplitInput[] {
  if (!source?.splits?.length) return [];
  return source.splits.map((s) => ({
    _key: String(s.subcategory_id),
    category_id: findCategoryId(categories, s.subcategory_id),
    subcategory_id: String(s.subcategory_id),
    amount: s.amount.toFixed(2),
  }));
}

// ─── Validation ──────────────────────────────────────────────────────────────

// "0" est une chaîne non-vide donc truthy : un simple `!amount` laisse passer
// un montant nul. On exige explicitement une valeur numérique strictement positive.
export function hasValidAmount(amount: string): boolean {
  return amount !== '' && (Number.parseFloat(amount) || 0) > 0;
}

export function validateSplits(rows: SplitInput[], total: number, t: TTx): string | null {
  if (rows.length === 0) return t('split_validation.err_no_rows');
  for (const s of rows) {
    if (!s.subcategory_id) return t('split_validation.err_no_subcat');
    if ((Number.parseFloat(s.amount) || 0) <= 0) return t('split_validation.err_no_amount');
  }
  const sum = rows.reduce((acc, s) => acc + Number.parseFloat(s.amount), 0);
  if (Math.abs(sum - total) > 0.01)
    return t('split_validation.err_total', { sum: sum.toFixed(2), total: total.toFixed(2) });
  return null;
}

export function isEditFormIncomplete(
  core: TxCoreState,
  isTransferEdit: boolean,
  isVentilated: boolean,
): boolean {
  if (!hasValidAmount(core.amount) || !core.description) return true;
  if (isTransferEdit) return !core.account_id || !core.to_account_id;
  return !core.account_id || (!isVentilated && !core.subcategory_id) || !core.payment_method_id;
}

export function isTxFormIncomplete(
  core: TxCoreState,
  fixedAccountId: number | undefined,
  isVentilated: boolean,
): boolean {
  if (!hasValidAmount(core.amount) || !core.description) return true;
  if (!Number.parseInt(core.payment_method_id)) return true;
  if (fixedAccountId == null && !core.account_id) return true;
  return !isVentilated && !Number.parseInt(core.subcategory_id);
}

export function buildSplitPayload(
  splits: SplitInput[],
): { subcategory_id: number; amount: number }[] {
  return splits.map((s) => ({
    subcategory_id: Number.parseInt(s.subcategory_id),
    amount: Number.parseFloat(s.amount),
  }));
}

/**
 * Patch à appliquer sur le core lorsqu'on bascule entre mode transaction
 * et mode transfert. Préfille la description du transfert avec le nom du
 * compte source pour aider l'utilisateur.
 */
export function buildToggleCore(
  c: TxCoreState,
  toTransfer: boolean,
  accounts: Account[],
  fixedAccountId: number | undefined,
): TxCoreState {
  if (toTransfer) {
    const srcId = fixedAccountId ?? Number.parseInt(c.account_id);
    const src = accounts.find((a) => a.id === srcId);
    return {
      ...c,
      subcategory_id: '',
      payment_method_id: '',
      to_account_id: '',
      description: src ? `${src.name} →` : '',
    };
  }
  return { ...c, to_account_id: '', description: '' };
}

// ─── i18n helpers ────────────────────────────────────────────────────────────

export function getModalTitle(
  isEdit: boolean,
  isDuplicate: boolean,
  isTransfer: boolean,
  t: TTx,
): string {
  if (isEdit) return t('modal.title_edit');
  if (isDuplicate && isTransfer) return t('modal.title_duplicate_transfer');
  if (isDuplicate) return t('modal.title_duplicate');
  if (isTransfer) return t('modal.title_transfer');
  return t('modal.title_new');
}

export function getSubmitLabel(
  isPending: boolean,
  isEdit: boolean,
  isTransferCreate: boolean,
  t: TTx,
  tc: TCommon,
): string {
  if (isPending) return tc('loading');
  if (isEdit) return t('modal.submit_edit');
  if (isTransferCreate) return t('modal.submit_transfer');
  return t('modal.submit_add');
}

export function getSchedulingOptions(
  isEdit: boolean,
  isTransferEdit: boolean,
  scheduledList: ScheduledTransaction[] | undefined,
): ScheduledTransaction[] {
  if (!isEdit || isTransferEdit) return [];
  return (scheduledList ?? []).filter((s) => s.active && s.to_account_id === null);
}

// ─── Submit runners ──────────────────────────────────────────────────────────

export interface EditCtx {
  isVentilated: boolean;
  splits: SplitInput[];
  core: TxCoreState;
  isTransferEdit: boolean;
  date: string;
  notes: string;
  validated: boolean;
  scheduledId: number | null;
  onSave: (data: TxFormState) => void;
  t: TTx;
}

export function runSubmitEdit(ctx: EditCtx): void {
  if (ctx.isVentilated) {
    const err = validateSplits(ctx.splits, Number.parseFloat(ctx.core.amount), ctx.t);
    if (err) {
      showToast(err);
      return;
    }
  }
  if (isEditFormIncomplete(ctx.core, ctx.isTransferEdit, ctx.isVentilated)) {
    showToast(ctx.t('modal.err_required'));
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
    notes: ctx.notes || null,
    validated: ctx.validated,
    isVentilated: ctx.isVentilated,
    splits: buildSplitPayload(ctx.splits),
    scheduled_id: ctx.scheduledId,
  });
}

export interface TxCtx {
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
  t: TTx;
}

export interface TransferCtx {
  core: TxCoreState;
  fixedAccountId: number | undefined;
  date: string;
  notes: string;
  validated: boolean;
  createTransfer: ReturnType<typeof useCreateTransfer>;
  onClose: () => void;
  t: TTx;
  tc: TCommon;
}

export function runSubmitTransfer(ctx: TransferCtx): void {
  if (!hasValidAmount(ctx.core.amount) || !ctx.core.to_account_id) {
    showToast(ctx.t('modal.err_transfer_required'));
    return;
  }
  ctx.createTransfer.mutate(
    {
      from_account_id: ctx.fixedAccountId ?? Number.parseInt(ctx.core.account_id),
      to_account_id: Number.parseInt(ctx.core.to_account_id),
      amount: Number.parseFloat(ctx.core.amount),
      description: ctx.core.description || ctx.tc('transfer'),
      date: ctx.date,
      notes: ctx.notes || null,
      validated: ctx.validated,
    },
    {
      onSuccess: () => {
        showToast(ctx.t('modal.success_transfer'));
        ctx.onClose();
      },
    },
  );
}

export function runSubmitTx(ctx: TxCtx): void {
  if (ctx.isVentilated) {
    const err = validateSplits(ctx.splits, Number.parseFloat(ctx.core.amount), ctx.t);
    if (err) {
      showToast(err);
      return;
    }
  }
  if (isTxFormIncomplete(ctx.core, ctx.fixedAccountId, ctx.isVentilated)) {
    showToast(ctx.t('modal.err_required'));
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
        showToast(ctx.t('modal.success_add'));
        ctx.onClose();
      },
    },
  );
}
