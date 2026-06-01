import { useTranslation } from 'react-i18next';

import { Button, Card, DecimalInput, Select } from '@/components/ui';
import type { AccountChoice } from '@/pages/import.helpers.ts';
import type { Account, AccountType, Bank } from '@/types.ts';

import { type ParsedFile, ParsedFileStats } from './Shared';

// ─── Account mapping row ──────────────────────────────────────────────────────

interface RowProps {
  qifName: string;
  choice: AccountChoice | undefined;
  accounts: Account[];
  accountTypes: AccountType[];
  banks: Bank[];
  onChange: (c: AccountChoice) => void;
}

function AccountMappingRow({
  qifName,
  choice,
  accounts,
  accountTypes,
  banks,
  onChange,
}: Readonly<RowProps>) {
  const { t } = useTranslation('settings');
  const label = qifName || t('import.no_account_explicit');
  const action = choice?.action ?? 'skip';

  const handleActionChange = (newAction: string) => {
    if (newAction === 'skip') {
      onChange({ action: 'skip' });
    } else if (newAction === 'map') {
      onChange({ action: 'map', account_id: accounts[0]?.id ?? 0 });
    } else {
      onChange({
        action: 'create',
        name: qifName || t('import.new_account_default'),
        bank_id: banks[0]?.id ?? null,
        bank_name: banks[0]?.name ?? null,
        account_type_id: accountTypes[0]?.id ?? null,
        initial_balance: choice?.action === 'create' ? choice.initial_balance : 0,
        opening_date: null,
      });
    }
  };

  return (
    <div className="py-3 border-b border-stone-100 last:border-0">
      <div className="flex items-start gap-4">
        <span className="flex-1 text-sm font-mono text-stone-700 pt-1.5 truncate" title={qifName}>
          {label}
        </span>
        <div className="flex flex-col gap-2 shrink-0 items-end">
          <Select
            aria-label={t('import.aria_action_for', { name: qifName })}
            className="w-36"
            value={action}
            onChange={(e) => handleActionChange(e.target.value)}
          >
            <option value="skip">{t('import.action_skip')}</option>
            <option value="map">{t('import.action_map')}</option>
            <option value="create">{t('import.action_create')}</option>
          </Select>

          {action === 'map' && (
            <Select
              aria-label={t('import.aria_target_account', { name: qifName })}
              className="w-56"
              value={choice?.action === 'map' ? choice.account_id : ''}
              onChange={(e) => onChange({ action: 'map', account_id: Number(e.target.value) })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}

          {action === 'create' && choice?.action === 'create' && (
            <div className="flex flex-col gap-1.5 items-end w-72">
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-stone-400 shrink-0 w-24 text-right">
                  {t('import.account_name_label')}
                </span>
                <input
                  className="flex-1 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-brand-500"
                  value={choice.name}
                  onChange={(e) => onChange({ ...choice, name: e.target.value })}
                  placeholder={t('import.account_name_placeholder')}
                />
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-stone-400 shrink-0 w-24 text-right">
                  {t('import.bank_label')}
                </span>
                <Select
                  className="flex-1"
                  value={choice.bank_id ?? ''}
                  onChange={(e) => {
                    const bank = banks.find((b) => b.id === Number(e.target.value));
                    onChange({
                      ...choice,
                      bank_id: bank?.id ?? null,
                      bank_name: bank?.name ?? null,
                    });
                  }}
                >
                  <option value="">{t('import.bank_none')}</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-stone-400 shrink-0 w-24 text-right">
                  {t('import.type_label')}
                </span>
                <Select
                  className="flex-1"
                  value={choice.account_type_id ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...choice,
                      account_type_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">{t('import.type_none')}</option>
                  {accountTypes.map((at) => (
                    <option key={at.id} value={at.id}>
                      {at.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-stone-400 shrink-0 w-24 text-right">
                  {t('import.initial_balance_label')}
                </span>
                <DecimalInput
                  aria-label={t('import.initial_balance_label')}
                  allowNegative
                  className="flex-1 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-brand-500"
                  value={String(choice.initial_balance)}
                  onChange={(e) =>
                    onChange({ ...choice, initial_balance: Number.parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-stone-400 shrink-0 w-24 text-right">
                  {t('import.opening_date_label')}
                </span>
                <input
                  type="date"
                  className="flex-1 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-brand-500"
                  value={choice.opening_date ?? ''}
                  onChange={(e) => onChange({ ...choice, opening_date: e.target.value || null })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AccountsStep ─────────────────────────────────────────────────────────────

interface AccountsStepProps {
  parsedFile: ParsedFile;
  fileName: string;
  dateFormat: 'MM/DD' | 'DD/MM';
  onDateFormatChange: (fmt: 'MM/DD' | 'DD/MM') => void;
  accountsToMap: string[];
  qifTransferTargets: string[];
  accountChoices: Map<string, AccountChoice>;
  setAccountChoice: (name: string, c: AccountChoice) => void;
  activeAccounts: Account[];
  accountTypes: AccountType[];
  banks: Bank[];
  onBack: () => void;
  onNext: () => void;
}

export function AccountsStep({
  parsedFile,
  fileName,
  dateFormat,
  onDateFormatChange,
  accountsToMap,
  qifTransferTargets,
  accountChoices,
  setAccountChoice,
  activeAccounts,
  accountTypes,
  banks,
  onBack,
  onNext,
}: Readonly<AccountsStepProps>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-4">
          {t('import.file_loaded')}
        </p>
        <div className="flex gap-6 text-sm text-stone-600">
          <span className="font-medium text-stone-800">{fileName}</span>
          <span className="uppercase text-[10px] font-bold tracking-widest text-stone-400 self-center">
            {parsedFile.format}
          </span>
          <ParsedFileStats pf={parsedFile} />
        </div>
      </Card>

      {parsedFile.format === 'qif' && (
        <Card>
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
            {t('import.date_format_title')}
          </p>
          <p className="text-xs text-stone-400 mb-3">
            {t('import.date_detected')}{' '}
            <strong>
              {parsedFile.data.detectedDateFormat === 'ambiguous'
                ? t('import.date_ambiguous')
                : parsedFile.data.detectedDateFormat}
            </strong>
          </p>
          <div className="flex gap-3">
            {(['DD/MM', 'MM/DD'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => onDateFormatChange(fmt)}
                className={`px-4 py-2 text-sm rounded-lg border transition-all ${dateFormat === fmt ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-200 text-stone-600 hover:border-stone-400'}`}
              >
                {fmt} {fmt === 'DD/MM' ? '(FR/EU)' : '(US)'}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
          {t('import.account_mapping_title')}
        </p>
        <p className="text-xs text-stone-400 mb-4">{t('import.account_mapping_desc')}</p>
        {accountsToMap.map((name) => (
          <AccountMappingRow
            key={name}
            qifName={name}
            choice={accountChoices.get(name)}
            accounts={activeAccounts}
            accountTypes={accountTypes}
            banks={banks}
            onChange={(c) => setAccountChoice(name, c)}
          />
        ))}
        {qifTransferTargets.length > 0 && (
          <>
            <p className="text-xs text-stone-400 mt-4 mb-1 pt-3 border-t border-stone-100">
              {t('import.transfer_targets_title')}
            </p>
            {qifTransferTargets.map((name) => (
              <AccountMappingRow
                key={name}
                qifName={name}
                choice={accountChoices.get(name)}
                accounts={activeAccounts}
                accountTypes={accountTypes}
                banks={banks}
                onChange={(c) => setAccountChoice(name, c)}
              />
            ))}
          </>
        )}
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack}>{tc('back')}</Button>
        <Button variant="primary" onClick={onNext}>
          {t('import.next_categories')}
        </Button>
      </div>
    </div>
  );
}
