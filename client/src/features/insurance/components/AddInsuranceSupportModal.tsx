import type { InsuranceSupportType } from '@cashctrl/types';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { useCreateInsuranceSupport } from '@/features/insurance/hooks/useInsurance';
import { isIsin, TickerInput } from '@/features/portfolio/components/TickerInput';

interface Props {
  accountId: number;
  onClose: () => void;
}

export function AddInsuranceSupportModal({ accountId, onClose }: Readonly<Props>) {
  const { t } = useTranslation('insurance');
  const { t: tc } = useTranslation('common');
  const [name, setName] = useState('');
  const [type, setType] = useState<InsuranceSupportType>('euro');
  const [ticker, setTicker] = useState('');
  const create = useCreateInsuranceSupport(accountId);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    create.mutate(
      { name, type, ticker: type === 'uc' && ticker ? ticker : null },
      {
        onSuccess: () => {
          showToast(t('add_support_modal.success'));
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <ModalFrame
      title={t('add_support_modal.title')}
      onClose={create.isPending ? undefined : onClose}
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={create.isPending}>
            {tc('cancel')}
          </Button>
          <Button
            type="submit"
            form="add-support-form"
            variant="primary"
            disabled={!name || create.isPending || isIsin(ticker)}
          >
            {t('add_support_modal.submit')}
          </Button>
        </>
      }
    >
      <form id="add-support-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormGroup label={t('add_support_modal.name_label')} htmlFor="add-support-name">
          <Input
            id="add-support-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('add_support_modal.name_placeholder')}
            required
            autoFocus
          />
        </FormGroup>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-content-subtle">
            {t('add_support_modal.type_label')}
          </span>
          <div className="flex gap-4">
            {(['euro', 'uc'] as const).map((supportType) => (
              <label key={supportType} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="support-type"
                  value={supportType}
                  checked={type === supportType}
                  onChange={() => setType(supportType)}
                />
                {supportType === 'euro'
                  ? t('add_support_modal.euro_type')
                  : t('add_support_modal.uc_type')}
              </label>
            ))}
          </div>
        </div>

        {type === 'uc' && (
          <FormGroup label={t('add_support_modal.ticker_label')} htmlFor="add-support-ticker">
            <TickerInput
              id="add-support-ticker"
              value={ticker}
              onChange={(v) => setTicker(v.toUpperCase())}
              placeholder={t('add_support_modal.ticker_placeholder')}
              className="font-mono"
            />
          </FormGroup>
        )}
      </form>
    </ModalFrame>
  );
}
