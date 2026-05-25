import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { importApi, JsonFullImportResult } from '@/api/client.ts';
import { Button, Card, DecimalInput, Select } from '@/components/ui';
import { useAccounts } from '@/hooks/useAccounts.ts';
import { useAccountTypes } from '@/hooks/useAccountTypes.ts';
import { useBanks } from '@/hooks/useBanks.ts';
import { useCategories } from '@/hooks/useCategories.ts';
import { usePaymentMethods } from '@/hooks/usePaymentMethods.ts';
import { fmtDate } from '@/lib/format.ts';
import { parseQif, QifParseResult } from '@/lib/qif-parser.ts';
import { parseXhb, XhbParseResult } from '@/lib/xhb-parser.ts';
import {
  type AccountChoice,
  buildExecuteBody,
  type CategoryChoice,
  findAutoCategory,
  findAutoPaymentMethod,
  resolvePreview,
  resolveXhbPreview,
  XHB_PAYMODE_NAMES,
} from '@/pages/import.helpers.ts';
import { Account, AccountType, Bank, Category, PaymentMethod } from '@/types.ts';

type Step = 'upload' | 'accounts' | 'categories' | 'paymethods' | 'preview' | 'confirm' | 'done';
type ParsedFile =
  | { format: 'qif'; data: QifParseResult }
  | { format: 'xhb'; data: XhbParseResult }
  | { format: 'json'; data: unknown };

function ParsedFileStats({ pf }: Readonly<{ pf: ParsedFile }>) {
  const { t } = useTranslation('settings');
  if (pf.format === 'qif') {
    return (
      <>
        <span>
          {pf.data.transactions.length} {t('import.label_transactions_count')}
        </span>
        <span>
          {pf.data.uniqueCategories.length} {t('import.label_categories_count')}
        </span>
        {pf.data.uniqueTransferTargets.length > 0 && (
          <span>
            {pf.data.uniqueTransferTargets.length} {t('import.label_transfer_targets')}
          </span>
        )}
      </>
    );
  }
  if (pf.format === 'xhb') {
    return (
      <>
        <span>
          {pf.data.transactions.length} {t('import.label_transactions_count')}
        </span>
        <span>
          {pf.data.transfers.length} {t('import.stats_transfers')}
        </span>
        <span>
          {pf.data.uniqueCategories.length} {t('import.label_categories_count')}
        </span>
        {pf.data.uniquePaymodes.length > 0 && (
          <span>
            {pf.data.uniquePaymodes.length} {t('import.label_paymode_count')}
          </span>
        )}
      </>
    );
  }
  return null;
}

function findBankByName(bankname: string, banks: Bank[]): number | null {
  if (!bankname) return banks[0]?.id ?? null;
  const lower = bankname.toLowerCase();
  const exact = banks.find((b) => b.name.toLowerCase() === lower);
  if (exact) return exact.id;
  const partial = banks.find(
    (b) => b.name.toLowerCase().includes(lower) || lower.includes(b.name.toLowerCase()),
  );
  return partial?.id ?? banks[0]?.id ?? null;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  step,
  format,
}: Readonly<{ step: Step; format: 'qif' | 'xhb' | 'json' | null }>) {
  const { t } = useTranslation('settings');
  const steps: { id: Step; label: string }[] =
    format === 'json'
      ? [
          { id: 'upload', label: t('import.step_file') },
          { id: 'confirm', label: t('import.step_confirm') },
          { id: 'done', label: t('import.step_done') },
        ]
      : [
          { id: 'upload', label: t('import.step_file') },
          { id: 'accounts', label: t('import.step_accounts') },
          { id: 'categories', label: t('import.step_categories') },
          ...(format === 'xhb'
            ? [{ id: 'paymethods' as Step, label: t('import.step_paymethods') }]
            : []),
          { id: 'preview', label: t('import.step_preview') },
          { id: 'done', label: t('import.step_done') },
        ];
  const current = steps.findIndex((s) => s.id === step);
  const containerStyles = {
    active: 'bg-stone-900 text-white',
    completed: 'text-stone-400',
    upcoming: 'text-stone-300',
  };
  const badgeStyles = {
    active: 'bg-white/20',
    completed: 'bg-stone-200',
    upcoming: 'bg-stone-100',
  };
  const lineStyles = {
    active: 'bg-stone-200',
    completed: 'bg-stone-400',
    upcoming: 'bg-stone-200',
  };
  const getStatus = (index: number, cur: number) => {
    if (index === cur) return 'active';
    if (index < cur) return 'completed';
    return 'upcoming';
  };

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${containerStyles[getStatus(i, current)]}`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${badgeStyles[getStatus(i, current)]}`}
            >
              {i < current ? '✓' : i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-6 h-px ${lineStyles[getStatus(i, current)]}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Account mapping row ──────────────────────────────────────────────────────

function AccountMappingRow({
  qifName,
  choice,
  accounts,
  accountTypes,
  banks,
  onChange,
}: Readonly<{
  qifName: string;
  choice: AccountChoice | undefined;
  accounts: Account[];
  accountTypes: AccountType[];
  banks: Bank[];
  onChange: (c: AccountChoice) => void;
}>) {
  const { t } = useTranslation('settings');
  const label = qifName || '(transactions sans compte explicite)';
  const action = choice?.action ?? 'skip';

  const handleActionChange = (newAction: string) => {
    if (newAction === 'skip') {
      onChange({ action: 'skip' });
    } else if (newAction === 'map') {
      onChange({ action: 'map', account_id: accounts[0]?.id ?? 0 });
    } else {
      onChange({
        action: 'create',
        name: qifName || 'Nouveau compte',
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
            aria-label={`Action pour ${qifName}`}
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
              aria-label={`Compte cible pour ${qifName}`}
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
                  className="flex-1 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
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
                  className="flex-1 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
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
                  className="flex-1 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
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

// ─── Category mapping row ─────────────────────────────────────────────────────

function CategoryMappingRow({
  qifCategory,
  choice,
  categories,
  onChange,
}: Readonly<{
  qifCategory: string;
  choice: CategoryChoice | undefined;
  categories: Category[];
  onChange: (c: CategoryChoice) => void;
}>) {
  const { t } = useTranslation('settings');
  const parts = qifCategory.split(':');
  const defaultSubcatName = parts.at(-1)!;
  const action = choice?.action ?? 'skip';

  const handleActionChange = (newAction: string) => {
    if (newAction === 'skip') onChange({ action: 'skip' });
    else if (newAction === 'map') {
      const firstSubcat = categories[0]?.subcategories[0];
      onChange({ action: 'map', subcategory_id: firstSubcat?.id ?? 0 });
    } else {
      onChange({
        action: 'create',
        existing_category_id: categories[0]?.id ?? null,
        new_category_name: parts[0] ?? qifCategory,
        new_category_icon: '📁',
        subcategory_name: defaultSubcatName,
      });
    }
  };

  return (
    <div className="py-3 border-b border-stone-100 last:border-0">
      <div className="flex items-start gap-4">
        <span
          className="flex-1 text-sm font-mono text-stone-700 pt-1.5 truncate"
          title={qifCategory}
        >
          {qifCategory}
        </span>
        <div className="flex flex-col gap-2 shrink-0 items-end">
          <Select
            aria-label={`Action pour ${qifCategory}`}
            className="w-32"
            value={action}
            onChange={(e) => handleActionChange(e.target.value)}
          >
            <option value="skip">{t('import.action_skip')}</option>
            <option value="map">{t('import.action_map')}</option>
            <option value="create">{t('import.action_create')}</option>
          </Select>

          {action === 'map' && (
            <Select
              aria-label={`Catégorie cible pour ${qifCategory}`}
              className="w-64"
              value={choice?.action === 'map' ? choice.subcategory_id : ''}
              onChange={(e) => onChange({ action: 'map', subcategory_id: Number(e.target.value) })}
            >
              {categories.map((cat) =>
                cat.subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {cat.name} / {sub.name}
                  </option>
                )),
              )}
            </Select>
          )}

          {action === 'create' && choice?.action === 'create' && (
            <div className="flex flex-col gap-1.5 items-end">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">{t('import.subcategory_label')}</span>
                <input
                  className="w-40 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
                  value={choice.subcategory_name}
                  onChange={(e) => onChange({ ...choice, subcategory_name: e.target.value })}
                  placeholder={t('import.subcategory_placeholder')}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">{t('import.parent_category_label')}</span>
                <Select
                  className="w-48"
                  value={choice.existing_category_id ?? '__new__'}
                  onChange={(e) =>
                    onChange({
                      ...choice,
                      existing_category_id:
                        e.target.value === '__new__' ? null : Number(e.target.value),
                    })
                  }
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="__new__">{t('import.new_category_option')}</option>
                </Select>
              </div>
              {choice.existing_category_id === null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">
                    {t('import.new_category_name_label')}
                  </span>
                  <input
                    className="w-40 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
                    value={choice.new_category_name}
                    onChange={(e) => onChange({ ...choice, new_category_name: e.target.value })}
                    placeholder={t('import.new_category_placeholder')}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Paymode mapping row ──────────────────────────────────────────────────────

function PaymodeMappingRow({
  paymode,
  paymentMethodId,
  paymentMethods,
  onChange,
}: Readonly<{
  paymode: number;
  paymentMethodId: number | null;
  paymentMethods: PaymentMethod[];
  onChange: (id: number | null) => void;
}>) {
  const { t } = useTranslation('settings');
  const name = XHB_PAYMODE_NAMES[paymode] ?? `Mode ${paymode}`;
  return (
    <div className="py-3 border-b border-stone-100 last:border-0">
      <div className="flex items-center gap-4">
        <span className="flex-1 text-sm font-mono text-stone-700">{name}</span>
        <Select
          aria-label={`Méthode de paiement pour ${name}`}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImportManager() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const activeAccounts = accounts.filter((a) => !a.closed_at);

  const [step, setStep] = useState<Step>('upload');
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [dateFormat, setDateFormat] = useState<'MM/DD' | 'DD/MM'>('DD/MM');
  const [accountChoices, setAccountChoices] = useState<Map<string, AccountChoice>>(new Map());
  const [categoryChoices, setCategoryChoices] = useState<Map<string, CategoryChoice>>(new Map());
  const [paymodeChoices, setPaymodeChoices] = useState<Map<number, number | null>>(new Map());
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useMutation({ mutationFn: importApi.executeQif });
  const jsonImportMutation = useMutation({ mutationFn: importApi.executeJsonFull });

  const isXhb = parsedFile?.format === 'xhb';

  const handleFile = useCallback(
    (file: File) => {
      const nameLower = file.name.toLowerCase();
      const isQifFile = nameLower.endsWith('.qif');
      const isXhbFile = nameLower.endsWith('.xhb');
      const isJsonFile = nameLower.endsWith('.json');

      if (!isQifFile && !isXhbFile && !isJsonFile) {
        setParseError(t('import.err_extension'));
        return;
      }
      setParseError('');

      const makeDefaultAccChoice = (name: string, initialBalance = 0): AccountChoice => ({
        action: 'create',
        name: name || 'Nouveau compte',
        bank_id: banks[0]?.id ?? null,
        bank_name: banks[0]?.name ?? null,
        account_type_id: accountTypes[0]?.id ?? null,
        initial_balance: initialBalance,
        opening_date: null,
      });

      const handleJsonFile = (text: string): boolean => {
        const data = JSON.parse(text) as { version?: unknown; amounts_in_cents?: unknown };
        if (data.version !== '1.0' || data.amounts_in_cents !== true) {
          setParseError(t('import.err_json_invalid'));
          return false;
        }
        setParsedFile({ format: 'json', data });
        setFileName(file.name);
        setStep('confirm');
        return true;
      };

      const handleQifFile = (text: string): boolean => {
        const result = parseQif(text);
        if (result.transactions.length === 0) {
          setParseError(t('import.err_no_transactions'));
          return false;
        }
        setParsedFile({ format: 'qif', data: result });
        setFileName(file.name);
        setDateFormat(result.detectedDateFormat === 'MM/DD' ? 'MM/DD' : 'DD/MM');

        const accChoices = new Map<string, AccountChoice>();
        for (const acc of result.accounts) accChoices.set(acc, makeDefaultAccChoice(acc));
        for (const target of result.uniqueTransferTargets) {
          if (!accChoices.has(target)) accChoices.set(target, makeDefaultAccChoice(target));
        }
        setAccountChoices(accChoices);

        const catChoices = new Map<string, CategoryChoice>();
        for (const qifCat of result.uniqueCategories) {
          catChoices.set(qifCat, findAutoCategory(qifCat, categories) ?? { action: 'skip' });
        }
        setCategoryChoices(catChoices);
        setPaymodeChoices(new Map());
        return true;
      };

      const handleXhbFile = (text: string): boolean => {
        const result = parseXhb(text);
        if (result.transactions.length + result.transfers.length === 0) {
          setParseError(t('import.err_no_transactions'));
          return false;
        }
        setParsedFile({ format: 'xhb', data: result });
        setFileName(file.name);

        const accChoices = new Map<string, AccountChoice>();
        for (const accName of result.accounts) {
          const details = result.accountDetails.get(accName);
          const bankId = findBankByName(details?.bankname ?? '', banks);
          const bankName = banks.find((b) => b.id === bankId)?.name ?? null;
          accChoices.set(accName, {
            action: 'create',
            name: accName,
            bank_id: bankId,
            bank_name: bankName,
            account_type_id: accountTypes[0]?.id ?? null,
            initial_balance: details?.initial ?? 0,
            opening_date: null,
          });
        }
        setAccountChoices(accChoices);

        const catChoices = new Map<string, CategoryChoice>();
        for (const cat of result.uniqueCategories) {
          catChoices.set(cat, findAutoCategory(cat, categories) ?? { action: 'skip' });
        }
        setCategoryChoices(catChoices);

        const pmChoices = new Map<number, number | null>();
        for (const paymode of result.uniquePaymodes) {
          pmChoices.set(paymode, findAutoPaymentMethod(paymode, paymentMethods));
        }
        setPaymodeChoices(pmChoices);
        return true;
      };

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          if (isJsonFile) {
            handleJsonFile(text);
            return;
          }
          const ok = isQifFile ? handleQifFile(text) : handleXhbFile(text);
          if (ok) setStep('accounts');
        } catch {
          setParseError(t('import.err_file_read'));
        }
      };
      reader.readAsText(file, 'UTF-8');
    },
    [categories, banks, accountTypes, paymentMethods],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const setAccountChoice = useCallback((name: string, c: AccountChoice) => {
    setAccountChoices((prev) => new Map(prev).set(name, c));
  }, []);

  const previewItems = useMemo(() => {
    if (!parsedFile) return [];
    if (parsedFile.format === 'qif') {
      return resolvePreview(
        parsedFile.data,
        dateFormat,
        accountChoices,
        categoryChoices,
        activeAccounts,
        categories,
      );
    }
    if (parsedFile.format === 'json') return [];
    return resolveXhbPreview(
      parsedFile.data,
      accountChoices,
      categoryChoices,
      paymodeChoices,
      activeAccounts,
      categories,
    );
  }, [
    parsedFile,
    dateFormat,
    accountChoices,
    categoryChoices,
    paymodeChoices,
    activeAccounts,
    categories,
  ]);

  const importableCount = previewItems.filter((it) => it.kind !== 'skip').length;
  const skippedCount = previewItems.filter((it) => it.kind === 'skip').length;
  const selectedTxCount = previewItems.filter(
    (it, i) => it.kind === 'transaction' && selected.has(i),
  ).length;
  const selectedTfCount = previewItems.filter(
    (it, i) => it.kind === 'transfer' && selected.has(i),
  ).length;

  const goToPreview = () => {
    const initialSelected = new Set<number>();
    previewItems.forEach((it, i) => {
      if (it.kind !== 'skip') initialSelected.add(i);
    });
    setSelected(initialSelected);
    setStep('preview');
  };

  const handleImport = async () => {
    const body = buildExecuteBody(previewItems, selected, accountChoices, categoryChoices);
    try {
      await importMutation.mutateAsync(body);
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setStep('done');
    } catch {
      /* error shown inline */
    }
  };

  const toggleItem = (i: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const selectAll = () => {
    const all = new Set<number>();
    previewItems.forEach((it, i) => {
      if (it.kind !== 'skip') all.add(i);
    });
    setSelected(all);
  };
  const deselectAll = () => setSelected(new Set());

  // Account list shown in the accounts step
  const accountsToMap: string[] = (() => {
    if (!parsedFile || parsedFile.format === 'json') return [];
    if (parsedFile.format === 'qif') return parsedFile.data.accounts;
    return parsedFile.data.accounts;
  })();

  // Transfer targets present in QIF but not in accounts list
  const qifTransferTargets =
    parsedFile?.format === 'qif'
      ? parsedFile.data.uniqueTransferTargets.filter((t) => !parsedFile.data.accounts.includes(t))
      : [];

  let uniqueCategories: string[] = [];
  if (parsedFile?.format === 'qif' || parsedFile?.format === 'xhb') {
    uniqueCategories = parsedFile.data.uniqueCategories;
  }

  return (
    <div className="max-w-4xl">
      <p className="text-sm text-stone-400 mb-8">{t('import.description')}</p>

      <StepIndicator step={step} format={parsedFile?.format ?? null} />

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <Card>
          <label
            className={`block border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${isDragging ? 'border-stone-400 bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="text-4xl mb-3 text-stone-300">⇪</div>
            <p className="text-sm font-medium text-stone-600 mb-1">{t('import.upload_label')}</p>
            <p className="text-xs text-stone-400">{t('import.upload_hint')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".qif,.xhb,.json"
              className="sr-only"
              aria-label={t('import.file_input_label')}
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />
          </label>
          {parseError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {parseError}
            </p>
          )}
        </Card>
      )}

      {/* ── Step 2: Accounts ── */}
      {step === 'accounts' && parsedFile && (
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
                    onClick={() => setDateFormat(fmt)}
                    className={`px-4 py-2 text-sm rounded-lg border transition-all ${dateFormat === fmt ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600 hover:border-stone-400'}`}
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
            <Button onClick={() => setStep('upload')}>{tc('back')}</Button>
            <Button variant="primary" onClick={() => setStep('categories')}>
              {t('import.next_categories')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Categories ── */}
      {step === 'categories' && parsedFile && (
        <div className="flex flex-col gap-6">
          <Card>
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
              {t('import.category_mapping_title')}
            </p>
            <p className="text-xs text-stone-400 mb-4">{t('import.category_mapping_desc')}</p>
            {uniqueCategories.length === 0 ? (
              <p className="text-sm text-stone-400 py-4 text-center">{t('import.no_categories')}</p>
            ) : (
              uniqueCategories.map((cat) => (
                <CategoryMappingRow
                  key={cat}
                  qifCategory={cat}
                  choice={categoryChoices.get(cat)}
                  categories={categories}
                  onChange={(c) => setCategoryChoices((prev) => new Map(prev).set(cat, c))}
                />
              ))
            )}
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setStep('accounts')}>{tc('back')}</Button>
            <Button
              variant="primary"
              onClick={() => (isXhb ? setStep('paymethods') : goToPreview())}
            >
              {isXhb ? t('import.next_paymethods') : t('import.next_preview')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4 (XHB only): Payment methods ── */}
      {step === 'paymethods' && parsedFile?.format === 'xhb' && (
        <div className="flex flex-col gap-6">
          <Card>
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
              {t('import.paymethod_title')}
            </p>
            <p className="text-xs text-stone-400 mb-4">{t('import.paymethod_desc')}</p>
            {parsedFile.data.uniquePaymodes.length === 0 ? (
              <p className="text-sm text-stone-400 py-4 text-center">{t('import.no_paymethods')}</p>
            ) : (
              parsedFile.data.uniquePaymodes.map((paymode) => (
                <PaymodeMappingRow
                  key={paymode}
                  paymode={paymode}
                  paymentMethodId={paymodeChoices.get(paymode) ?? null}
                  paymentMethods={paymentMethods}
                  onChange={(id) => setPaymodeChoices((prev) => new Map(prev).set(paymode, id))}
                />
              ))
            )}
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setStep('categories')}>{tc('back')}</Button>
            <Button variant="primary" onClick={goToPreview}>
              {t('import.next_preview')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step JSON: Confirm ── */}
      {step === 'confirm' &&
        parsedFile?.format === 'json' &&
        (() => {
          const d = parsedFile.data as Record<string, unknown[]>;
          const txs = (d.transactions ?? []) as Array<{ transfer_peer_id: unknown }>;
          const transferCount = txs.filter((t) => t.transfer_peer_id !== null).length / 2;
          const stats = [
            { value: (d.accounts ?? []).length, label: t('import.stats_accounts') },
            { value: txs.length - transferCount * 2, label: t('import.stats_transactions') },
            { value: Math.round(transferCount), label: t('import.stats_transfers') },
            { value: (d.scheduled_transactions ?? []).length, label: t('import.stats_scheduled') },
            { value: (d.stock_operations ?? []).length, label: t('import.stats_stock_ops') },
            { value: (d.loans ?? []).length, label: t('import.stats_loans') },
          ].filter(({ value }) => value > 0);
          const cats = (d.categories ?? []) as Array<{ subcategories: unknown[] }>;
          const subcatCount = cats.reduce((s, c) => s + c.subcategories.length, 0);

          const handleJsonImport = async () => {
            try {
              await jsonImportMutation.mutateAsync(parsedFile.data);
              await queryClient.invalidateQueries({ queryKey: ['accounts'] });
              setStep('done');
            } catch {
              /* error shown inline */
            }
          };

          return (
            <div className="flex flex-col gap-6">
              <div className="flex gap-4 flex-wrap">
                {stats.map(({ value, label }) => (
                  <div
                    key={label}
                    className="flex-1 min-w-22.5 bg-white border border-black/[0.07] rounded-2xl p-4 shadow-sm text-center"
                  >
                    <p className="text-2xl font-sans text-stone-800">{value}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <Card>
                <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-3">
                  {t('import.confirm_content_title')}
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-stone-600">
                  <span>{t('import.confirm_categories')}</span>
                  <span className="text-stone-800 font-medium">
                    {t('import.confirm_categories_count', {
                      count: cats.length,
                      subcount: subcatCount,
                    })}
                  </span>
                  <span>{t('import.confirm_payment_methods')}</span>
                  <span className="text-stone-800 font-medium">
                    {(d.payment_methods ?? []).length}
                  </span>
                  <span>{t('import.confirm_account_types')}</span>
                  <span className="text-stone-800 font-medium">
                    {(d.account_types ?? []).length}
                  </span>
                  <span>{t('import.confirm_stock_positions')}</span>
                  <span className="text-stone-800 font-medium">
                    {(d.stock_positions ?? []).length}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-4">{t('import.confirm_note')}</p>
              </Card>

              {jsonImportMutation.isError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="font-medium mb-1">{tc('error_import')}</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {jsonImportMutation.error.message.split('\n').map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  onClick={() => {
                    setStep('upload');
                    setParsedFile(null);
                    setFileName('');
                    jsonImportMutation.reset();
                  }}
                >
                  {tc('back')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleJsonImport}
                  disabled={jsonImportMutation.isPending}
                >
                  {jsonImportMutation.isPending ? t('import.importing') : t('import.import_btn')}
                </Button>
              </div>
            </div>
          );
        })()}

      {/* ── Step 4/5: Preview ── */}
      {step === 'preview' && (
        <div className="flex flex-col gap-6">
          <div className="flex gap-4">
            {[
              { value: selectedTxCount, label: t('import.stats_transactions') },
              { value: selectedTfCount, label: t('import.stats_transfers') },
              { value: skippedCount, label: t('import.stats_ignored') },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="flex-1 bg-white border border-black/[0.07] rounded-2xl p-4 shadow-sm text-center"
              >
                <p className="text-2xl font-sans text-stone-800">{value}</p>
                <p className="text-xs text-stone-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
                {t('import.preview_transactions', {
                  importable: importableCount,
                  skipped: skippedCount,
                })}
              </p>
              <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === importableCount && importableCount > 0}
                  onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
                  className="rounded"
                />
                <span>{tc('all_select')}</span>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-stone-400 border-b border-stone-100">
                    <th className="pb-2 w-6" />
                    <th className="pb-2 pr-3">{tc('date')}</th>
                    <th className="pb-2 pr-3">Description</th>
                    <th className="pb-2 pr-3">Compte</th>
                    <th className="pb-2 pr-3">Catégorie</th>
                    <th className="pb-2 text-right">{tc('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, i) => {
                    if (item.kind === 'skip') {
                      return (
                        <tr
                          key={`skip-${item.idx}`}
                          className="text-stone-300 border-b border-stone-50"
                        >
                          <td className="py-1.5 w-6" />
                          <td className="py-1.5 pr-3">{item.date ? fmtDate(item.date) : '—'}</td>
                          <td className="py-1.5 pr-3 max-w-40 truncate" title={item.description}>
                            {item.description}
                          </td>
                          <td className="py-1.5 pr-3 italic text-stone-300" colSpan={2}>
                            {item.reason}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {item.amount.toFixed(2)}
                          </td>
                        </tr>
                      );
                    }
                    const isChecked = selected.has(i);
                    if (item.kind === 'transfer') {
                      return (
                        <tr
                          key={`transfer-${item.idxPrimary}`}
                          className={`border-b border-stone-100 ${isChecked ? '' : 'opacity-40'}`}
                        >
                          <td className="py-1.5 w-6">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItem(i)}
                              className="rounded"
                            />
                          </td>
                          <td className="py-1.5 pr-3">{fmtDate(item.date)}</td>
                          <td className="py-1.5 pr-3 max-w-40 truncate" title={item.description}>
                            {item.description}
                          </td>
                          <td className="py-1.5 pr-3 text-indigo-600">
                            {item.fromAccountName}
                            {item.fromAccountQifName ? t('import.new_account_suffix') : ''} →{' '}
                            {item.toAccountName}
                            {item.toAccountQifName ? t('import.new_account_suffix') : ''}
                          </td>
                          <td className="py-1.5 pr-3 text-stone-400 italic">
                            {t('import.transfer_label')}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-indigo-600">
                            {item.amount.toFixed(2)} €
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr
                        key={`tx-${item.idx}`}
                        className={`border-b border-stone-100 ${isChecked ? '' : 'opacity-40'}`}
                      >
                        <td className="py-1.5 w-6">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(i)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-1.5 pr-3">{fmtDate(item.date)}</td>
                        <td className="py-1.5 pr-3 max-w-40 truncate" title={item.description}>
                          {item.description}
                        </td>
                        <td className="py-1.5 pr-3 text-stone-600">
                          {item.accountName}
                          {item.newAccountQifName ? t('import.new_account_suffix') : ''}
                        </td>
                        <td className="py-1.5 pr-3 text-stone-400">{item.categoryLabel || '—'}</td>
                        <td
                          className={`py-1.5 text-right tabular-nums ${item.type === 'income' ? 'text-green-700' : 'text-stone-800'}`}
                        >
                          {item.type === 'expense' ? '-' : '+'}
                          {item.amount.toFixed(2)} €
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {importMutation.isError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="font-medium mb-1">{tc('error_import')}</p>
              <ul className="list-disc list-inside space-y-0.5">
                {importMutation.error.message.split('\n').map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between">
            <Button onClick={() => setStep(isXhb ? 'paymethods' : 'categories')}>
              {tc('back')}
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={selected.size === 0 || importMutation.isPending}
            >
              {importMutation.isPending
                ? t('import.importing')
                : t('import.import_n', { count: selected.size })}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 5/6: Done ── */}
      {step === 'done' && (importMutation.data ?? jsonImportMutation.data) && (
        <Card>
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✓</div>
            <h2 className="font-sans text-2xl text-stone-800 mb-2">{t('import.done_title')}</h2>
            {importMutation.data && (
              <div className="flex justify-center gap-8 mt-6 mb-8">
                <div>
                  <p className="text-3xl font-sans text-stone-800">
                    {importMutation.data.transactions}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">{t('import.imported_transactions')}</p>
                </div>
                <div>
                  <p className="text-3xl font-sans text-stone-800">
                    {importMutation.data.transfers}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">{t('import.imported_transfers')}</p>
                </div>
              </div>
            )}
            {jsonImportMutation.data &&
              (() => {
                const r: JsonFullImportResult = jsonImportMutation.data;
                const stats = [
                  { value: r.accounts, label: t('import.stats_cats_created') },
                  { value: r.transactions, label: t('import.stats_transactions') },
                  { value: r.transfers, label: t('import.stats_transfers') },
                  { value: r.scheduled, label: t('import.stats_scheduled') },
                  { value: r.stockOperations, label: t('import.stats_stock_ops') },
                  { value: r.loans, label: t('import.stats_loans') },
                ].filter(({ value }) => value > 0);
                return (
                  <div className="flex justify-center flex-wrap gap-6 mt-6 mb-8">
                    {stats.map(({ value, label }) => (
                      <div key={label}>
                        <p className="text-3xl font-sans text-stone-800">{value}</p>
                        <p className="text-xs text-stone-400 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => {
                  setStep('upload');
                  setParsedFile(null);
                  setFileName('');
                  importMutation.reset();
                  jsonImportMutation.reset();
                }}
              >
                {t('import.new_import_btn')}
              </Button>
              <Button
                variant="primary"
                onClick={() => (globalThis.location.href = '/transactions')}
              >
                {t('import.view_transactions_btn')}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
