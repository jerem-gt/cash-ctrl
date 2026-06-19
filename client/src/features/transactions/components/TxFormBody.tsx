import type { Account, Category, PaymentMethod } from '@cashctrl/types';
import { useTranslation } from 'react-i18next';

import { TxCoreFields, type TxCoreState } from '@/features/transactions/components/TxCoreFields';
import { type SplitInput, TxSplitEditor } from '@/features/transactions/components/TxSplitEditor';
import { TxTransferFields } from '@/features/transactions/components/TxTransferFields';

interface Props {
  isTransferEdit: boolean;
  isTransferCreate: boolean;
  isVentilated: boolean;
  onToggleVentilation: () => void;
  splits: SplitInput[];
  onSplitsChange: (s: SplitInput[]) => void;
  core: TxCoreState;
  onCorePatch: (patch: Partial<TxCoreState>) => void;
  accounts: Account[];
  logoMap: Record<string, string | null>;
  categories: Pick<Category, 'id' | 'name' | 'subcategories'>[];
  paymentMethods: Pick<PaymentMethod, 'id' | 'name' | 'icon'>[];
  fixedAccountId: number | undefined;
  fieldErrors?: Set<string>;
}

export function TxFormBody({
  isTransferEdit,
  isTransferCreate,
  isVentilated,
  onToggleVentilation,
  splits,
  onSplitsChange,
  core,
  onCorePatch,
  accounts,
  logoMap,
  categories,
  paymentMethods,
  fixedAccountId,
  fieldErrors,
}: Readonly<Props>) {
  const { t } = useTranslation('transactions');

  if (isTransferEdit) {
    return (
      <TxTransferFields core={core} onPatch={onCorePatch} accounts={accounts} logoMap={logoMap} />
    );
  }

  const ventilateLabel = isVentilated ? t('modal.ventilated') : t('modal.ventilate');
  const ventilateClass = isVentilated
    ? 'bg-info-surface text-info hover:bg-info-surface'
    : 'text-content-subtle hover:text-content-secondary hover:bg-surface-muted';

  return (
    <>
      <TxCoreFields
        value={core}
        onChange={onCorePatch}
        accounts={accounts}
        logoMap={logoMap}
        categories={categories}
        paymentMethods={paymentMethods}
        isTransfer={isTransferCreate}
        fixedAccountId={fixedAccountId}
        hideCategories={isVentilated}
        fieldErrors={fieldErrors}
      />
      {!isTransferCreate && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onToggleVentilation}
              className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all ${ventilateClass}`}
            >
              {ventilateLabel}
            </button>
          </div>
          {isVentilated && (
            <TxSplitEditor
              splits={splits}
              onChange={onSplitsChange}
              categories={categories}
              totalAmount={Number.parseFloat(core.amount) || 0}
            />
          )}
        </>
      )}
    </>
  );
}
