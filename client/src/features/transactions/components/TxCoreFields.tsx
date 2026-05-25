import { useTranslation } from 'react-i18next';

import { DecimalInput, FormGroup, Input, Select } from '@/components/ui';
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { transferLabel } from '@/lib/transfer-label';
import type { Account, Subcategory } from '@/types';

export interface TxCoreState {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  category_id: string;
  subcategory_id: string;
  account_id: string;
  to_account_id: string;
  payment_method_id: string;
}

interface Props {
  value: TxCoreState;
  onChange: (patch: Partial<TxCoreState>) => void;
  accounts: Account[];
  logoMap: Record<string, string | null>;
  categories: { id: number; name: string; subcategories: Subcategory[] }[];
  paymentMethods: { id: number; name: string; icon: string }[];
  isTransfer: boolean;
  /** Si fourni, le sélecteur de compte source est masqué et ce compte est utilisé. */
  fixedAccountId?: number;
  /** Masque les sélecteurs catégorie/sous-catégorie (mode ventilation). */
  hideCategories?: boolean;
}

export function TxCoreFields({
  value,
  onChange,
  accounts,
  logoMap,
  categories,
  paymentMethods,
  isTransfer,
  fixedAccountId,
  hideCategories,
}: Readonly<Props>) {
  const { t } = useTranslation('transactions');
  const sourceAccount =
    fixedAccountId == null
      ? accounts.find((a) => String(a.id) === value.account_id)
      : accounts.find((a) => a.id === fixedAccountId);

  const destAccounts =
    fixedAccountId == null
      ? accounts.filter((a) => String(a.id) !== value.account_id)
      : accounts.filter((a) => a.id !== fixedAccountId);

  const handleSourceChange = (v: string) => {
    if (isTransfer) {
      const newSource = accounts.find((a) => String(a.id) === v);
      const dest = accounts.find((a) => String(a.id) === value.to_account_id);
      onChange({
        account_id: v,
        to_account_id: value.to_account_id === v ? '' : value.to_account_id,
        description: transferLabel(newSource, dest && String(dest.id) !== v ? dest : undefined),
      });
    } else {
      onChange({ account_id: v });
    }
  };

  const handleDestChange = (v: string) => {
    const dest = accounts.find((a) => String(a.id) === v);
    onChange({
      to_account_id: v,
      description: transferLabel(sourceAccount, dest),
    });
  };

  return (
    <>
      {/* Ligne 1 : type (masqué transfert) + montant + description */}
      <div className="flex gap-3 flex-wrap">
        {!isTransfer && (
          <FormGroup label={t('tx_core.type_label')}>
            <Select
              value={value.type}
              onChange={(e) => onChange({ type: e.target.value as 'income' | 'expense' })}
            >
              <option value="expense">{t('tx_core.expense')}</option>
              <option value="income">{t('tx_core.income')}</option>
            </Select>
          </FormGroup>
        )}
        <FormGroup label={t('tx_core.amount')}>
          <DecimalInput
            value={value.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0,00"
          />
        </FormGroup>
        <FormGroup label={t('tx_core.description')} className="min-w-48">
          <Input
            type="text"
            value={value.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={isTransfer ? `${sourceAccount?.name ?? ''} → …` : 'Ex : Courses Leclerc'}
          />
        </FormGroup>
      </div>

      {/* Ligne 2 : catégorie (masquée transfert) + compte(s) + moyen de paiement (masqué transfert) */}
      <div className="grid grid-cols-2 gap-3">
        {!isTransfer && !hideCategories && (
          <>
            <FormGroup label={t('tx_core.category')}>
              <Select
                id="category-select"
                value={value.category_id}
                onChange={(e) => onChange({ category_id: e.target.value, subcategory_id: '' })}
              >
                <option value="">{t('tx_core.choose')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormGroup>
            <FormGroup label={t('tx_core.subcategory')}>
              <Select
                disabled={!value.category_id} // Désactivé si aucune catégorie n'est choisie
                id="subcategory-select"
                className="disabled:opacity-50 disabled:cursor-not-allowed"
                value={value.subcategory_id}
                onChange={(e) => onChange({ subcategory_id: e.target.value })}
              >
                <option value="">{t('tx_core.choose')}</option>
                {categories
                  .find((c) => String(c.id) === String(value.category_id))
                  ?.subcategories?.map((sub) => (
                    <option key={sub.id} value={String(sub.id)}>
                      {sub.name}
                    </option>
                  ))}
              </Select>
            </FormGroup>
          </>
        )}
        {fixedAccountId == null && (
          <FormGroup label={isTransfer ? t('tx_core.account_source') : t('tx_core.account')}>
            <AccountSelect
              id="source-account-select"
              value={value.account_id}
              onChange={handleSourceChange}
              accounts={accounts}
              logoMap={logoMap}
            />
          </FormGroup>
        )}
        {isTransfer && (
          <FormGroup label={t('tx_core.account_dest')}>
            <AccountSelect
              id="dest-account-select"
              value={value.to_account_id}
              onChange={handleDestChange}
              accounts={destAccounts}
              logoMap={logoMap}
              placeholder="— Choisir —"
            />
          </FormGroup>
        )}
        {!isTransfer && (
          <FormGroup label={t('tx_core.payment_method')}>
            <Select
              id="payment-method-select"
              value={value.payment_method_id}
              onChange={(e) => onChange({ payment_method_id: e.target.value })}
            >
              <option value="">{t('tx_core.choose')}</option>
              {paymentMethods
                .filter((m) => m.name !== 'Transfert')
                .map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.icon} {m.name}
                  </option>
                ))}
            </Select>
          </FormGroup>
        )}
      </div>
    </>
  );
}
