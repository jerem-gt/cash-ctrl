import type { Account } from '@/types';
import { FormGroup, Input, Select } from '@/components/ui';
import { AccountSelect } from '@/components/AccountSelect';

export interface TxCoreState {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  category_id: string;
  account_id: string;
  to_account_id: string;
  payment_method_id: string;
}

interface Props {
  value: TxCoreState;
  onChange: (patch: Partial<TxCoreState>) => void;
  accounts: Account[];
  logoMap: Record<string, string | null>;
  categories: { id: number; name: string }[];
  paymentMethods: { id: number; name: string; icon: string }[];
  /** Si fourni, le sélecteur de compte source est masqué et ce compte est utilisé. */
  fixedAccountId?: number;
}

export function TxCoreFields({
  value, onChange, accounts, logoMap, categories, paymentMethods, fixedAccountId,
}: Readonly<Props>) {
  const selectedPm = paymentMethods.find(m => String(m.id) === value.payment_method_id);
  const isTransfer = selectedPm?.name === 'Transfert';

  const sourceAccount = fixedAccountId != null
    ? accounts.find(a => a.id === fixedAccountId)
    : accounts.find(a => String(a.id) === value.account_id);

  const destAccounts = fixedAccountId != null
    ? accounts.filter(a => a.id !== fixedAccountId)
    : accounts.filter(a => String(a.id) !== value.account_id);

  const handlePaymentMethodChange = (pmId: string) => {
    const pm = paymentMethods.find(m => String(m.id) === pmId);
    const nowTransfer = pm?.name === 'Transfert';
    const wasTransfer = isTransfer;
    onChange({
      payment_method_id: pmId,
      description: nowTransfer
        ? `${sourceAccount?.name ?? ''} →`
        : wasTransfer ? '' : value.description,
      to_account_id: nowTransfer ? value.to_account_id : '',
    });
  };

  const handleSourceChange = (v: string) => {
    if (isTransfer) {
      const newSource = accounts.find(a => String(a.id) === v);
      const dest = accounts.find(a => String(a.id) === value.to_account_id);
      onChange({
        account_id: v,
        to_account_id: value.to_account_id === v ? '' : value.to_account_id,
        description: dest && String(dest.id) !== v
          ? `${newSource?.name ?? ''} → ${dest.name}`
          : `${newSource?.name ?? ''} →`,
      });
    } else {
      onChange({ account_id: v });
    }
  };

  const handleDestChange = (v: string) => {
    const dest = accounts.find(a => String(a.id) === v);
    onChange({
      to_account_id: v,
      description: dest
        ? `${sourceAccount?.name ?? ''} → ${dest.name}`
        : `${sourceAccount?.name ?? ''} →`,
    });
  };

  return (
    <>
      {/* Ligne 1 : type (masqué transfert) + montant + description */}
      <div className="flex gap-3 flex-wrap">
        {!isTransfer && (
          <FormGroup label="Type">
            <Select value={value.type} onChange={e => onChange({ type: e.target.value as 'income' | 'expense' })}>
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
            </Select>
          </FormGroup>
        )}
        <FormGroup label="Montant (€)">
          <Input
            type="number"
            value={value.amount}
            onChange={e => onChange({ amount: e.target.value })}
            placeholder="0,00"
            min="0.01"
            step="0.01"
          />
        </FormGroup>
        <FormGroup label="Description" className="min-w-48">
          <Input
            type="text"
            value={value.description}
            onChange={e => onChange({ description: e.target.value })}
            placeholder={isTransfer ? `${sourceAccount?.name ?? ''} → …` : 'Ex : Courses Leclerc'}
          />
        </FormGroup>
      </div>

      {/* Ligne 2 : catégorie (masquée transfert) + compte(s) + moyen de paiement */}
      <div className="flex gap-3 flex-wrap">
        {!isTransfer && (
          <FormGroup label="Catégorie">
            <Select value={value.category_id} onChange={e => onChange({ category_id: e.target.value })}>
              <option value="">— Choisir —</option>
              {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </Select>
          </FormGroup>
        )}
        {fixedAccountId == null && (
          <FormGroup label={isTransfer ? 'Compte source' : 'Compte'}>
            <AccountSelect
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
              value={value.to_account_id}
              onChange={handleDestChange}
              accounts={destAccounts}
              logoMap={logoMap}
              placeholder="— Choisir —"
            />
          </FormGroup>
        )}
        <FormGroup label="Moyen de paiement">
          <Select value={value.payment_method_id} onChange={e => handlePaymentMethodChange(e.target.value)}>
            <option value="">— Choisir —</option>
            {paymentMethods.map(m => <option key={m.id} value={String(m.id)}>{m.icon} {m.name}</option>)}
          </Select>
        </FormGroup>
      </div>
    </>
  );
}
