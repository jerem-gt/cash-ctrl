import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ModalFrame, showToast } from '@/components/ui';
import { ReimbursementsPanel } from '@/features/transactions/components/ReimbursementsPanel';
import { ReimbursementStatusPicker } from '@/features/transactions/components/ReimbursementStatusPicker';
import { type TxCoreState } from '@/features/transactions/components/TxCoreFields';
import { TxFormBody } from '@/features/transactions/components/TxFormBody';
import { TxMetaFields } from '@/features/transactions/components/TxMetaFields';
import { TxModalHeader } from '@/features/transactions/components/TxModalHeader';
import { type SplitInput } from '@/features/transactions/components/TxSplitEditor';
import { useScheduled } from '@/features/transactions/hooks/useScheduled';
import {
  buildToggleCore,
  getModalTitle,
  getSchedulingOptions,
  getSubmitLabel,
  initCore,
  initSplits,
  runSubmitEdit,
  runSubmitTransfer,
  runSubmitTx,
  type TxFormState,
  validateSplits,
} from '@/features/transactions/lib/txForm';
import { useCreateTransaction, useCreateTransfer } from '@/hooks/useTransactions';
import { today } from '@/lib/format';
import type { Account, Category, PaymentMethod, ReimbursementStatus, Transaction } from '@/types';

function addCategoryErrors(core: TxCoreState, errs: Set<string>): void {
  if (!Number.parseInt(core.category_id)) errs.add('category_id');
  else if (!Number.parseInt(core.subcategory_id)) errs.add('subcategory_id');
}

function buildEditErrors(
  core: TxCoreState,
  isTransferEdit: boolean,
  isVentilated: boolean,
): Set<string> {
  const errs = new Set<string>();
  if (!core.amount) errs.add('amount');
  if (!core.description) errs.add('description');
  if (isTransferEdit) {
    if (!core.account_id) errs.add('account_id');
    if (!core.to_account_id) errs.add('to_account_id');
  } else {
    if (!core.account_id) errs.add('account_id');
    if (!isVentilated) addCategoryErrors(core, errs);
    if (!core.payment_method_id) errs.add('payment_method_id');
  }
  return errs;
}

function buildTransferCreateErrors(core: TxCoreState): Set<string> {
  const errs = new Set<string>();
  if (!core.amount) errs.add('amount');
  if (!core.to_account_id) errs.add('to_account_id');
  return errs;
}

function buildTxCreateErrors(
  core: TxCoreState,
  fixedAccountId: number | undefined,
  isVentilated: boolean,
): Set<string> {
  const errs = new Set<string>();
  if (!core.amount) errs.add('amount');
  if (!core.description) errs.add('description');
  if (!Number.parseInt(core.payment_method_id)) errs.add('payment_method_id');
  if (fixedAccountId == null && !core.account_id) errs.add('account_id');
  if (!isVentilated) addCategoryErrors(core, errs);
  return errs;
}

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

export function TxModal(props: Readonly<Props>) {
  const { t } = useTranslation('transactions');
  const { t: tc } = useTranslation('common');
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
  const [notes, setNotes] = useState(tx?.notes ?? duplicateFrom?.notes ?? '');
  const [validated, setValidated] = useState(isEdit ? !!tx!.validated : false);
  const [reimbursementStatus, setReimbursementStatus] = useState<ReimbursementStatus>(null);
  const [isTransfer, setIsTransfer] = useState(!!duplicateFrom?.transfer_peer_id);
  const [scheduledId, setScheduledId] = useState<number | null>(tx?.scheduled_id ?? null);
  const [isVentilated, setIsVentilated] = useState(() => !!(tx ?? duplicateFrom)?.splits?.length);
  const [splits, setSplits] = useState<SplitInput[]>(() =>
    initSplits(tx ?? duplicateFrom, categories),
  );
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());

  const createTx = useCreateTransaction();
  const createTransfer = useCreateTransfer();
  const { data: scheduledList } = useScheduled();
  const isTransferCreate = !isEdit && isTransfer;
  const noOtherAccounts = fixedAccountId != null && accounts.every((a) => a.id === fixedAccountId);

  const handleModeToggle = (toTransfer: boolean) => {
    setFieldErrors(new Set());
    setIsTransfer(toTransfer);
    if (toTransfer) {
      setIsVentilated(false);
      setSplits([]);
    }
    setCore((c) => buildToggleCore(c, toTransfer, accounts, fixedAccountId));
  };

  const handleToggleVentilation = () => {
    setFieldErrors(new Set());
    setIsVentilated((v) => !v);
    setSplits([]);
    setCore((c) => ({ ...c, category_id: '', subcategory_id: '' }));
  };

  const buildErrors = (): Set<string> => {
    if (isEdit) return buildEditErrors(core, isTransferEdit, isVentilated);
    if (isTransferCreate) return buildTransferCreateErrors(core);
    return buildTxCreateErrors(core, fixedAccountId, isVentilated);
  };

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (isVentilated && !isTransferCreate) {
      const err = validateSplits(splits, Number.parseFloat(core.amount) || 0, t);
      if (err) {
        showToast(err);
        return;
      }
    }
    const errs = buildErrors();
    setFieldErrors(errs);
    if (errs.size > 0) {
      showToast(t('modal.err_required'));
      return;
    }
    if (isEdit) {
      runSubmitEdit({
        isVentilated,
        splits,
        core,
        isTransferEdit,
        date,
        notes,
        validated,
        scheduledId,
        onSave: (props as EditProps).onSave,
        t,
      });
      return;
    }
    if (isTransferCreate) {
      runSubmitTransfer({
        core,
        fixedAccountId,
        date,
        notes,
        validated,
        createTransfer,
        onClose,
        t,
        tc,
      });
      return;
    }
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
      t,
    });
  };

  const createPending = createTx.isPending || createTransfer.isPending;
  const isPending = isEdit ? (props as EditProps).isPending : createPending;

  const modalTitle = getModalTitle(isEdit, isDuplicate, isTransfer, t);
  const submitLabel = getSubmitLabel(isPending, isEdit, isTransferCreate, t, tc);

  const showNoOtherAccounts = !isEdit && isTransfer && noOtherAccounts;
  if (showNoOtherAccounts) {
    return (
      <ModalFrame title={modalTitle} size="lg" onClose={onClose}>
        <TxModalHeader
          isEdit={isEdit}
          isTransferEdit={isTransferEdit}
          isTransfer={isTransfer}
          noOtherAccounts={noOtherAccounts}
          onToggle={handleModeToggle}
        />
        <p className="text-sm text-content-subtle">{t('modal.no_other_account')}</p>
      </ModalFrame>
    );
  }

  const schedulingOptions =
    isEdit && !isTransferEdit ? getSchedulingOptions(isEdit, isTransferEdit, scheduledList) : [];

  return (
    <ModalFrame
      title={modalTitle}
      size="lg"
      onClose={isPending ? undefined : onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form="tx-modal-form" variant="primary" disabled={isPending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <TxModalHeader
        isEdit={isEdit}
        isTransferEdit={isTransferEdit}
        isTransfer={isTransfer}
        noOtherAccounts={noOtherAccounts}
        onToggle={handleModeToggle}
      />

      <form id="tx-modal-form" onSubmit={handleSubmit} className="space-y-3">
        <TxFormBody
          isTransferEdit={isTransferEdit}
          isTransferCreate={isTransferCreate}
          isVentilated={isVentilated}
          onToggleVentilation={handleToggleVentilation}
          splits={splits}
          onSplitsChange={setSplits}
          core={core}
          onCorePatch={(patch) => {
            setFieldErrors((prev) => {
              const s = new Set(prev);
              Object.keys(patch).forEach((k) => s.delete(k));
              return s;
            });
            setCore((c) => ({ ...c, ...patch }));
          }}
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          fixedAccountId={fixedAccountId}
          fieldErrors={fieldErrors}
        />

        <TxMetaFields
          date={date}
          onDateChange={setDate}
          notes={notes}
          onNotesChange={setNotes}
          validated={validated}
          onValidatedChange={setValidated}
          schedulingOptions={schedulingOptions}
          scheduledId={scheduledId}
          onScheduledChange={setScheduledId}
        />

        {isEdit && tx!.type === 'expense' && !isTransferEdit && <ReimbursementsPanel tx={tx!} />}

        {!isEdit && !isTransferCreate && core.type === 'expense' && (
          <ReimbursementStatusPicker
            status={reimbursementStatus}
            onChange={setReimbursementStatus}
          />
        )}
      </form>
    </ModalFrame>
  );
}
