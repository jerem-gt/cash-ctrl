import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, FormGroup, Input, Select, showToast } from '@/components/ui';
import { useCloseAccount } from '@/hooks/useAccounts';
import { accountDisplayBalance } from '@/lib/account';
import { fmtDec, today } from '@/lib/format';
import type { Account } from '@/types';

interface Props {
  account: Account;
  activeAccounts: Account[];
  onClose: () => void;
}

export function CloseAccountModal({ account, activeAccounts, onClose }: Readonly<Props>) {
  const { t } = useTranslation('accounts');
  const { t: tc } = useTranslation('common');

  const balance = Math.round(accountDisplayBalance(account) * 100) / 100;
  const needsTransfer = balance !== 0;

  const [closedAt, setClosedAt] = useState(today);
  const [transferToId, setTransferToId] = useState('');

  const closeAccount = useCloseAccount();

  const transferTargets = activeAccounts.filter((a) => a.id !== account.id);

  const handleSubmit = () => {
    if (needsTransfer && !transferToId) {
      showToast(t('close_modal.err_no_destination'));
      return;
    }
    if (!closedAt) {
      showToast(t('close_modal.err_no_date'));
      return;
    }
    closeAccount.mutate(
      {
        id: account.id,
        closed_at: closedAt,
        ...(needsTransfer ? { transfer_to_account_id: Number.parseInt(transferToId) } : {}),
      },
      {
        onSuccess: () => {
          showToast(t('close_modal.success'));
          onClose();
        },
        onError: (e) => showToast(e.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-1">{t('close_modal.title')}</h3>
        <p className="text-sm text-stone-400 mb-5">{account.name}</p>

        {needsTransfer ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
            <Trans
              i18nKey="close_modal.balance_warning"
              ns="accounts"
              values={{ balance: fmtDec(balance) }}
              components={{ bold: <span className="font-semibold" /> }}
            />
          </div>
        ) : (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-5 text-sm text-stone-600">
            {t('close_modal.balance_zero')}
          </div>
        )}

        <div className="space-y-3">
          {needsTransfer && (
            <FormGroup label={t('close_modal.transfer_to')}>
              <Select value={transferToId} onChange={(e) => setTransferToId(e.target.value)}>
                <option value="">{t('close_modal.choose_account')}</option>
                {transferTargets.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                    {a.bank ? ` (${a.bank})` : ''}
                  </option>
                ))}
              </Select>
            </FormGroup>
          )}
          <FormGroup label={t('close_modal.closing_date')}>
            <Input type="date" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} />
          </FormGroup>
        </div>

        <div className="flex gap-2 justify-end pt-5">
          <Button type="button" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleSubmit}
            disabled={closeAccount.isPending}
          >
            {closeAccount.isPending ? tc('loading') : t('close_modal.close_btn')}
          </Button>
        </div>
      </div>
    </div>
  );
}
