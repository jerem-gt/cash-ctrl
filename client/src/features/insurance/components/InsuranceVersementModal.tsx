import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { useVersement } from '@/features/insurance/hooks/useInsurance';
import { useAccounts } from '@/hooks/useAccounts';
import { useLogoMap } from '@/hooks/useLogoMap';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceVersementModal({ accountId, support, onClose }: Readonly<Props>) {
  const { t } = useTranslation('insurance');
  const { t: tc } = useTranslation('common');
  const [amount, setAmount] = useState('');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const versement = useVersement(accountId);
  const { data: allAccounts = [] } = useAccounts();
  const logoMap = useLogoMap();

  const sourceAccounts = allAccounts.filter(
    (a) => a.envelope_type == null && a.closed_at == null && a.id !== accountId,
  );

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    versement.mutate(
      {
        support_id: support.id,
        amount: Number.parseFloat(amount),
        fees: Number.parseFloat(fees) || 0,
        date,
        source_account_id: sourceAccountId ? Number(sourceAccountId) : null,
      },
      {
        onSuccess: () => {
          showToast(t('versement_modal.success'));
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <ModalFrame
      title={t('versement_modal.title', { support: support.name })}
      onClose={versement.isPending ? undefined : onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormGroup label={t('versement_modal.amount_label')} htmlFor="vers-amount">
          <DecimalInput
            id="vers-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
        </FormGroup>

        {sourceAccounts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="vers-source"
              className="text-[11px] font-medium uppercase tracking-wider text-content-subtle"
            >
              <span>{t('versement_modal.source_account_label')}</span>
              <span className="ml-1 text-content-faint normal-case tracking-normal font-normal">
                {tc('optional')}
              </span>
            </label>
            <AccountSelect
              id="vers-source"
              value={sourceAccountId}
              onChange={setSourceAccountId}
              accounts={sourceAccounts}
              logoMap={logoMap}
              placeholder={tc('none')}
            />
          </div>
        )}

        <div className="flex gap-3">
          <FormGroup label={t('versement_modal.fees_label')} htmlFor="vers-fees">
            <DecimalInput id="vers-fees" value={fees} onChange={(e) => setFees(e.target.value)} />
          </FormGroup>
          <FormGroup label={tc('date')} htmlFor="vers-date">
            <Input
              id="vers-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </FormGroup>
        </div>

        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" onClick={onClose} disabled={versement.isPending}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={!amount || versement.isPending}>
            {versement.isPending ? tc('loading') : tc('save')}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
