import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { importApi } from '@/api/client.ts';
import { useAccounts } from '@/hooks/useAccounts.ts';
import { useAccountTypes } from '@/hooks/useAccountTypes.ts';
import { useBanks } from '@/hooks/useBanks.ts';
import { useCategories } from '@/hooks/useCategories.ts';
import { usePaymentMethods } from '@/hooks/usePaymentMethods.ts';
import { parseQif } from '@/lib/qif-parser.ts';
import { parseXhb } from '@/lib/xhb-parser.ts';
import {
  type AccountChoice,
  buildExecuteBody,
  type CategoryChoice,
  findAutoCategory,
  findAutoPaymentMethod,
  resolvePreview,
  resolveXhbPreview,
} from '@/pages/import.helpers.ts';

import { AccountsStep } from './import/AccountsStep';
import { CategoriesStep } from './import/CategoriesStep';
import { DoneStep } from './import/DoneStep';
import { type JsonConfirmData, JsonConfirmStep } from './import/JsonConfirmStep';
import { PaymodesStep } from './import/PaymodesStep';
import { PreviewStep } from './import/PreviewStep';
import { findBankByName, type ParsedFile, type Step, StepIndicator } from './import/Shared';
import { UploadStep } from './import/UploadStep';

export default function ImportManager() {
  const { t } = useTranslation('settings');
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
  const [accountChoices, setAccountChoices] = useState<Map<string, AccountChoice>>(() => new Map());
  const [categoryChoices, setCategoryChoices] = useState<Map<string, CategoryChoice>>(
    () => new Map(),
  );
  const [paymodeChoices, setPaymodeChoices] = useState<Map<number, number | null>>(() => new Map());
  const [selected, setSelected] = useState<Set<number>>(() => new Set());

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
        name: name || t('import.new_account_default'),
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
    [categories, banks, accountTypes, paymentMethods, t],
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

  const setCategoryChoice = useCallback((key: string, c: CategoryChoice) => {
    setCategoryChoices((prev) => new Map(prev).set(key, c));
  }, []);

  const setPaymodeChoice = useCallback((paymode: number, id: number | null) => {
    setPaymodeChoices((prev) => new Map(prev).set(paymode, id));
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

  // Listes dérivées du parsedFile
  const accountsToMap: string[] = (() => {
    if (!parsedFile || parsedFile.format === 'json') return [];
    if (parsedFile.format === 'qif') return parsedFile.data.accounts;
    return parsedFile.data.accounts;
  })();

  const qifTransferTargets =
    parsedFile?.format === 'qif'
      ? parsedFile.data.uniqueTransferTargets.filter((t) => !parsedFile.data.accounts.includes(t))
      : [];

  let uniqueCategories: string[] = [];
  if (parsedFile?.format === 'qif' || parsedFile?.format === 'xhb') {
    uniqueCategories = parsedFile.data.uniqueCategories;
  }

  const handleJsonImport = async () => {
    if (parsedFile?.format !== 'json') return;
    try {
      await jsonImportMutation.mutateAsync(parsedFile.data);
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setStep('done');
    } catch {
      /* error shown inline */
    }
  };

  let jsonConfirmData: JsonConfirmData | null = null;
  if (step === 'confirm' && parsedFile?.format === 'json') {
    const d = parsedFile.data as Record<string, unknown[]>;
    const txs = (d.transactions ?? []) as Array<{ transfer_peer_id: unknown }>;
    const transferCount = txs.filter((tx) => tx.transfer_peer_id !== null).length / 2;
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
    jsonConfirmData = { d, stats, cats, subcatCount };
  }

  const jsonImportStats = jsonImportMutation.data
    ? [
        { value: jsonImportMutation.data.accounts, label: t('import.stats_cats_created') },
        { value: jsonImportMutation.data.transactions, label: t('import.stats_transactions') },
        { value: jsonImportMutation.data.transfers, label: t('import.stats_transfers') },
        { value: jsonImportMutation.data.scheduled, label: t('import.stats_scheduled') },
        { value: jsonImportMutation.data.stockOperations, label: t('import.stats_stock_ops') },
        { value: jsonImportMutation.data.loans, label: t('import.stats_loans') },
      ].filter(({ value }) => value > 0)
    : [];

  const resetAll = () => {
    setStep('upload');
    setParsedFile(null);
    setFileName('');
    importMutation.reset();
    jsonImportMutation.reset();
  };

  return (
    <div className="max-w-4xl">
      <p className="text-sm text-stone-400 mb-8">{t('import.description')}</p>

      <StepIndicator step={step} format={parsedFile?.format ?? null} />

      {step === 'upload' && (
        <UploadStep
          isDragging={isDragging}
          parseError={parseError}
          onDragOver={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onFile={handleFile}
        />
      )}

      {step === 'accounts' && parsedFile && (
        <AccountsStep
          parsedFile={parsedFile}
          fileName={fileName}
          dateFormat={dateFormat}
          onDateFormatChange={setDateFormat}
          accountsToMap={accountsToMap}
          qifTransferTargets={qifTransferTargets}
          accountChoices={accountChoices}
          setAccountChoice={setAccountChoice}
          activeAccounts={activeAccounts}
          accountTypes={accountTypes}
          banks={banks}
          onBack={() => setStep('upload')}
          onNext={() => setStep('categories')}
        />
      )}

      {step === 'categories' && parsedFile && (
        <CategoriesStep
          uniqueCategories={uniqueCategories}
          categoryChoices={categoryChoices}
          setCategoryChoice={setCategoryChoice}
          categories={categories}
          isXhb={isXhb}
          onBack={() => setStep('accounts')}
          onNext={() => (isXhb ? setStep('paymethods') : goToPreview())}
        />
      )}

      {step === 'paymethods' && parsedFile?.format === 'xhb' && (
        <PaymodesStep
          paymodes={parsedFile.data.uniquePaymodes}
          paymodeChoices={paymodeChoices}
          setPaymodeChoice={setPaymodeChoice}
          paymentMethods={paymentMethods}
          onBack={() => setStep('categories')}
          onNext={goToPreview}
        />
      )}

      {step === 'confirm' && parsedFile?.format === 'json' && jsonConfirmData && (
        <JsonConfirmStep
          data={jsonConfirmData}
          isPending={jsonImportMutation.isPending}
          errorMessage={jsonImportMutation.isError ? jsonImportMutation.error.message : null}
          onBack={resetAll}
          onImport={() => void handleJsonImport()}
        />
      )}

      {step === 'preview' && (
        <PreviewStep
          previewItems={previewItems}
          selected={selected}
          importableCount={importableCount}
          skippedCount={skippedCount}
          selectedTxCount={selectedTxCount}
          selectedTfCount={selectedTfCount}
          toggleItem={toggleItem}
          selectAll={selectAll}
          deselectAll={deselectAll}
          isPending={importMutation.isPending}
          errorMessage={importMutation.isError ? importMutation.error.message : null}
          onBack={() => setStep(isXhb ? 'paymethods' : 'categories')}
          onImport={() => void handleImport()}
        />
      )}

      {step === 'done' && (importMutation.data ?? jsonImportMutation.data) && (
        <DoneStep
          qifResult={importMutation.data ?? null}
          jsonStats={jsonImportStats}
          onReset={resetAll}
        />
      )}
    </div>
  );
}
