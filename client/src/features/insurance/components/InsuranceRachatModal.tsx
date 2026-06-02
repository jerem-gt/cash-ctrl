import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { AccountSelect } from '@/features/accounts/components/AccountSelect';
import { useRachat } from '@/features/insurance/hooks/useInsurance';
import { useAccounts } from '@/hooks/useAccounts';
import { useLogoMap } from '@/hooks/useLogoMap';
import { liquidAccounts } from '@/lib/account';
import { fmtDec, today } from '@/lib/format';
import { parseIdOrNull } from '@/lib/parse';
import type { InsuranceSupportView } from '@/types';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceRachatModal({ accountId, support, onClose }: Readonly<Props>) {
  const { t } = useTranslation('insurance');
  const { t: tc } = useTranslation('common');
  const [amount, setAmount] = useState('');
  const [fees, setFees] = useState('0');
  const [socialFees, setSocialFees] = useState('0');
  const [date, setDate] = useState(today);
  const [destAccountId, setDestAccountId] = useState('');
  const rachat = useRachat(accountId);
  const { data: allAccounts = [] } = useAccounts();
  const logoMap = useLogoMap();

  const destAccounts = liquidAccounts(allAccounts, accountId);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    rachat.mutate(
      {
        support_id: support.id,
        amount: Number.parseFloat(amount),
        fees: Number.parseFloat(fees) || 0,
        social_fees: Number.parseFloat(socialFees) || 0,
        date,
        dest_account_id: parseIdOrNull(destAccountId),
      },
      {
        onSuccess: () => {
          showToast(t('rachat_modal.success'));
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <ModalFrame
      title={t('rachat_modal.title', { support: support.name })}
      onClose={rachat.isPending ? undefined : onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="rachat-amount"
              className="text-[11px] font-medium uppercase tracking-wider text-content-subtle"
            >
              {t('rachat_modal.amount_label')}
            </label>
            <span className="text-[10px] text-content-subtle">
              {t('rachat_modal.max_label')} {fmtDec(support.value)}
            </span>
          </div>
          <DecimalInput
            id="rachat-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
        </div>

        {destAccounts.length > 0 && (
          <FormGroup label={t('rachat_modal.dest_account_label')} htmlFor="rachat-dest" optional>
            <AccountSelect
              id="rachat-dest"
              value={destAccountId}
              onChange={setDestAccountId}
              accounts={destAccounts}
              logoMap={logoMap}
              placeholder={tc('none')}
            />
          </FormGroup>
        )}

        <div className="flex gap-3 items-end">
          <FormGroup label={t('rachat_modal.fees_label')} htmlFor="rachat-fees">
            <DecimalInput id="rachat-fees" value={fees} onChange={(e) => setFees(e.target.value)} />
          </FormGroup>
          <FormGroup label={t('rachat_modal.social_fees_label')} htmlFor="rachat-social-fees">
            <DecimalInput
              id="rachat-social-fees"
              value={socialFees}
              onChange={(e) => setSocialFees(e.target.value)}
            />
          </FormGroup>
          <FormGroup label={tc('date')} htmlFor="rachat-date" className="min-w-36">
            <Input
              id="rachat-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </FormGroup>
        </div>

        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" onClick={onClose} disabled={rachat.isPending}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={!amount || rachat.isPending}>
            {rachat.isPending ? tc('loading') : tc('save')}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
