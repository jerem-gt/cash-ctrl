import { AccountSelect } from '@/components/AccountSelect';
import { FormGroup, Input, Select } from '@/components/ui';
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
}

type AccountRef = { name: string; bank?: string | null };

function transferLabel(src?: AccountRef, dest?: AccountRef): string {
  if (!src) return '';
  if (!dest) return `${src.name} →`;
  if (src.bank && dest.bank && src.bank !== dest.bank) return `${src.bank} → ${dest.bank}`;
  return `${src.name} → ${dest.name}`;
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
}: Readonly<Props>) {
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
          <FormGroup label="Type">
            <Select
              value={value.type}
              onChange={(e) => onChange({ type: e.target.value as 'income' | 'expense' })}
            >
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
            </Select>
          </FormGroup>
        )}
        <FormGroup label="Montant (€)">
          <Input
            type="number"
            value={value.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0,00"
            min="0.01"
            step="0.01"
          />
        </FormGroup>
        <FormGroup label="Description" className="min-w-48">
          <Input
            type="text"
            value={value.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={isTransfer ? `${sourceAccount?.name ?? ''} → …` : 'Ex : Courses Leclerc'}
          />
        </FormGroup>
      </div>

      {/* Ligne 2 : catégorie (masquée transfert) + compte(s) + moyen de paiement (masqué transfert) */}
      <div className="flex gap-3 flex-wrap">
        {!isTransfer && (
          <>
            <FormGroup label="Catégorie">
              <Select
                id="category-select"
                value={value.category_id}
                onChange={(e) => onChange({ category_id: e.target.value, subcategory_id: '' })}
              >
                <option value="">— Choisir —</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormGroup>
            <FormGroup label="Sous-catégorie">
              <Select
                disabled={!value.category_id} // Désactivé si aucune catégorie n'est choisie
                id="subcategory-select"
                className="disabled:opacity-50 disabled:cursor-not-allowed"
                value={value.subcategory_id}
                onChange={(e) => onChange({ subcategory_id: e.target.value })}
              >
                <option value="">— Choisir —</option>
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
          <FormGroup label={isTransfer ? 'Compte source' : 'Compte'}>
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
          <FormGroup label="Compte destination">
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
          <FormGroup label="Moyen de paiement">
            <Select
              id="payment-method-select"
              value={value.payment_method_id}
              onChange={(e) => onChange({ payment_method_id: e.target.value })}
            >
              <option value="">— Choisir —</option>
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
