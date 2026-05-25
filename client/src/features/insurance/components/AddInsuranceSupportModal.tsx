import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormGroup, Input, showToast } from '@/components/ui';
import { useCreateInsuranceSupport } from '@/features/insurance/hooks/useInsurance';
import { isIsin, TickerInput } from '@/features/portfolio/components/TickerInput';
import type { InsuranceSupportType } from '@/types';

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
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-5">{t('add_support_modal.title')}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
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

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={create.isPending}>
              {tc('cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!name || create.isPending || isIsin(ticker)}
            >
              {t('add_support_modal.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
