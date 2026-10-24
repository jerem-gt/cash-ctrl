import type { Category, FrequentTransaction } from '@cashctrl/types';
import { useTranslation } from 'react-i18next';

import {
  TX_AMOUNT_INPUT_ID,
  type TxCoreState,
} from '@/features/transactions/components/TxCoreFields';
import { useFrequentTransactions } from '@/hooks/useTransactions';

interface Props {
  accountId: number | undefined;
  core: TxCoreState;
  categories: Pick<Category, 'id' | 'name' | 'icon' | 'subcategories'>[];
  onPick: (patch: Partial<TxCoreState>) => void;
}

function isActive(f: FrequentTransaction, core: TxCoreState): boolean {
  return (
    core.type === f.type &&
    core.description.trim().toLowerCase() === f.description.toLowerCase() &&
    core.subcategory_id === String(f.subcategory_id) &&
    core.payment_method_id === (f.payment_method_id === null ? '' : String(f.payment_method_id))
  );
}

export function FrequentTxChips({ accountId, core, categories, onPick }: Readonly<Props>) {
  const { t } = useTranslation('transactions');
  const { data } = useFrequentTransactions(accountId);

  if (!data || data.length === 0) return null;

  const pick = (f: FrequentTransaction) => {
    onPick({
      type: f.type,
      description: f.description,
      category_id: String(f.category_id),
      subcategory_id: String(f.subcategory_id),
      payment_method_id: f.payment_method_id === null ? '' : String(f.payment_method_id),
    });
    document.getElementById(TX_AMOUNT_INPUT_ID)?.focus();
  };

  return (
    <div
      role="group"
      aria-label={t('frequent.label')}
      className="flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto md:overflow-visible pb-1"
    >
      {data.map((f) => {
        const category = categories.find((c) => c.id === f.category_id);
        const subcategory = category?.subcategories.find((s) => s.id === f.subcategory_id);
        const active = isActive(f, core);
        const style = active
          ? 'bg-brand-500/10 border-brand-500 text-brand-600'
          : 'bg-surface border-line text-content-secondary hover:bg-surface-muted';
        return (
          <button
            key={`${f.type}-${f.description}-${f.subcategory_id}-${f.payment_method_id}`}
            type="button"
            aria-pressed={active}
            title={t('frequent.title', {
              category: category?.name ?? '',
              subcategory: subcategory?.name ?? '',
              times: f.count,
            })}
            onClick={() => pick(f)}
            className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors ${style}`}
          >
            <span aria-hidden="true">{category?.icon ?? ''}</span>
            <span className="max-w-40 truncate">{f.description}</span>
          </button>
        );
      })}
    </div>
  );
}
