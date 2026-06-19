import type { Account } from '@cashctrl/types';
import { useTranslation } from 'react-i18next';

import { DecimalInput, FormGroup, Input } from '@/components/ui';
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { type TxCoreState } from '@/features/transactions/components/TxCoreFields';

interface Props {
  core: TxCoreState;
  onPatch: (patch: Partial<TxCoreState>) => void;
  accounts: Account[];
  logoMap: Record<string, string | null>;
}

export function TxTransferFields({ core, onPatch, accounts, logoMap }: Readonly<Props>) {
  const { t } = useTranslation('transactions');
  const { t: tc } = useTranslation('common');

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        <FormGroup label={t('modal.amount')}>
          <DecimalInput
            value={core.amount}
            onChange={(e) => onPatch({ amount: e.target.value })}
            placeholder="0,00"
          />
        </FormGroup>
        <FormGroup label={t('modal.description')}>
          <Input
            type="text"
            value={core.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder={t('modal.description_placeholder_transfer')}
          />
        </FormGroup>
      </div>
      <div className="flex gap-3 flex-wrap">
        <FormGroup label={t('modal.source_account')}>
          <AccountSelect
            id="source-account-select"
            value={core.account_id}
            onChange={(v) => onPatch({ account_id: v })}
            accounts={accounts}
            logoMap={logoMap}
          />
        </FormGroup>
        <FormGroup label={t('modal.dest_account')}>
          <AccountSelect
            id="dest-account-select"
            value={core.to_account_id}
            onChange={(v) => onPatch({ to_account_id: v })}
            accounts={accounts.filter((a) => String(a.id) !== core.account_id)}
            logoMap={logoMap}
            placeholder={tc('choose')}
          />
        </FormGroup>
      </div>
    </div>
  );
}
