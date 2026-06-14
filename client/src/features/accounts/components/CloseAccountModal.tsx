import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, FormGroup, Input, ModalFrame, Select, showToast } from '@/components/ui';
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
  const [errors, setErrors] = useState<Set<string>>(new Set());

  const closeAccount = useCloseAccount();

  const transferTargets = activeAccounts.filter((a) => a.id !== account.id);

  const handleSubmit = () => {
    const errs = new Set<string>();
    if (needsTransfer && !transferToId) errs.add('transfer_to');
    if (!closedAt) errs.add('closed_at');
    if (errs.size > 0) {
      setErrors(errs);
      if (errs.has('transfer_to')) showToast(t('close_modal.err_no_destination'));
      else showToast(t('close_modal.err_no_date'));
      return;
    }
    setErrors(new Set());
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
    <ModalFrame
      title={t('close_modal.title')}
      subtitle={account.name}
      onClose={closeAccount.isPending ? undefined : onClose}
      footer={
        <>
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
        </>
      }
    >
      {needsTransfer ? (
        <div className="bg-warning-surface border border-warning/30 rounded-xl p-4 mb-5 text-sm text-warning">
          <Trans
            i18nKey="close_modal.balance_warning"
            ns="accounts"
            values={{ balance: fmtDec(balance) }}
            components={{ bold: <span className="font-semibold" /> }}
          />
        </div>
      ) : (
        <div className="bg-surface-muted border border-line rounded-xl p-4 mb-5 text-sm text-content-secondary">
          {t('close_modal.balance_zero')}
        </div>
      )}

      <div className="space-y-3">
        {needsTransfer && (
          <FormGroup label={t('close_modal.transfer_to')}>
            <Select
              value={transferToId}
              onChange={(e) => {
                setErrors((p) => {
                  const s = new Set(p);
                  s.delete('transfer_to');
                  return s;
                });
                setTransferToId(e.target.value);
              }}
              error={errors.has('transfer_to')}
            >
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
          <Input
            type="date"
            value={closedAt}
            onChange={(e) => {
              setErrors((p) => {
                const s = new Set(p);
                s.delete('closed_at');
                return s;
              });
              setClosedAt(e.target.value);
            }}
            error={errors.has('closed_at')}
          />
        </FormGroup>
      </div>
    </ModalFrame>
  );
}
