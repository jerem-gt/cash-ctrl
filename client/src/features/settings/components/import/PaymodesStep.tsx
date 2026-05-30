import { useTranslation } from 'react-i18next';

import { Button, Card, Select } from '@/components/ui';
import { XHB_PAYMODE_NAMES } from '@/pages/import.helpers.ts';
import type { PaymentMethod } from '@/types.ts';

// ─── Paymode mapping row ──────────────────────────────────────────────────────

interface RowProps {
  paymode: number;
  paymentMethodId: number | null;
  paymentMethods: PaymentMethod[];
  onChange: (id: number | null) => void;
}

function PaymodeMappingRow({
  paymode,
  paymentMethodId,
  paymentMethods,
  onChange,
}: Readonly<RowProps>) {
  const { t } = useTranslation('settings');
  const name = XHB_PAYMODE_NAMES[paymode] ?? `Mode ${paymode}`;
  return (
    <div className="py-3 border-b border-stone-100 last:border-0">
      <div className="flex items-center gap-4">
        <span className="flex-1 text-sm font-mono text-stone-700">{name}</span>
        <Select
          aria-label={t('import.aria_paymethod', { name })}
          className="w-56"
          value={paymentMethodId ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{t('import.paymethod_ignore')}</option>
          {paymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.icon} {pm.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

// ─── PaymodesStep ─────────────────────────────────────────────────────────────

interface PaymodesStepProps {
  paymodes: number[];
  paymodeChoices: Map<number, number | null>;
  setPaymodeChoice: (paymode: number, id: number | null) => void;
  paymentMethods: PaymentMethod[];
  onBack: () => void;
  onNext: () => void;
}

export function PaymodesStep({
  paymodes,
  paymodeChoices,
  setPaymodeChoice,
  paymentMethods,
  onBack,
  onNext,
}: Readonly<PaymodesStepProps>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
          {t('import.paymethod_title')}
        </p>
        <p className="text-xs text-stone-400 mb-4">{t('import.paymethod_desc')}</p>
        {paymodes.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">{t('import.no_paymethods')}</p>
        ) : (
          paymodes.map((paymode) => (
            <PaymodeMappingRow
              key={paymode}
              paymode={paymode}
              paymentMethodId={paymodeChoices.get(paymode) ?? null}
              paymentMethods={paymentMethods}
              onChange={(id) => setPaymodeChoice(paymode, id)}
            />
          ))
        )}
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack}>{tc('back')}</Button>
        <Button variant="primary" onClick={onNext}>
          {t('import.next_preview')}
        </Button>
      </div>
    </div>
  );
}
