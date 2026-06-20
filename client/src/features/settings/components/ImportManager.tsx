import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError, type ApiErrorField, importApi, translateErrorField } from '@/api/client.ts';
import { useAccounts } from '@/hooks/useAccounts.ts';
import { useAccountTypes } from '@/hooks/useAccountTypes.ts';
import { useBanks } from '@/hooks/useBanks.ts';
import { useCategories } from '@/hooks/useCategories.ts';
import { useCategorizationRules } from '@/hooks/useCategorizationRules';
import { useLogoMap } from '@/hooks/useLogoMap.ts';
import { usePaymentMethods } from '@/hooks/usePaymentMethods.ts';
import { buildLedgerFromCsv, type CsvMapping } from '@/lib/csv-import.helpers';
import { type CsvParseResult, detectDecimalSeparator, parseCsvRaw } from '@/lib/csv-parser.ts';
import {
  type AccountChoice,
  buildExecuteBody,
  buildRowIndex,
  type CategoryChoice,
  findAutoCategory,
  findAutoPaymentMethod,
  type ImportErrors,
  likeMatch,
  resolvePreview,
  resolveXhbPreview,
} from '@/lib/import.helpers';
import { parseQif } from '@/lib/qif-parser.ts';
import { parseXhb } from '@/lib/xhb-parser.ts';

import { AccountsStep } from './import/AccountsStep';
import { CategoriesStep } from './import/CategoriesStep';
import { ColumnsStep } from './import/ColumnsStep';
import { DoneStep } from './import/DoneStep';
import { type JsonConfirmData, JsonConfirmStep } from './import/JsonConfirmStep';
import { PaymodesStep } from './import/PaymodesStep';
import { PreviewStep } from './import/PreviewStep';
import { findBankByName, type ParsedFile, type Step, StepIndicator } from './import/Shared';
import { UploadStep } from './import/UploadStep';

const NO_IMPORT_ERRORS: ImportErrors = { rows: new Map(), global: [] };

function noMatcher(): null {
  return null;
}

/** Remonte les erreurs de validation serveur (par champ) sur les lignes de l'aperçu. */
function mapImportErrors(
  fields: ApiErrorField[],
  txRows: number[],
  tfRows: number[],
): ImportErrors {
  const rows = new Map<number, string[]>();
  const global: string[] = [];
  for (const f of fields) {
    const [head, idxStr] = f.path.split('.');
    const msg = translateErrorField(f);
    let rowList: number[] | null = null;
    if (head === 'transactions') rowList = txRows;
    else if (head === 'transfers') rowList = tfRows;
    const row = rowList ? rowList[Number(idxStr)] : undefined;
    if (row === undefined) {
      global.push(msg);
    } else {
      const existing = rows.get(row);
      if (existing) existing.push(msg);
      else rows.set(row, [msg]);
    }
  }
  return { rows, global };
}

export default function ImportManager() {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const activeAccounts = accounts.filter((a) => !a.closed_at);
  const logoMap = useLogoMap();

  const { data: categorizationRules = [] } = useCategorizationRules();

  const [step, setStep] = useState<Step>('upload');
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [sourceFormat, setSourceFormat] = useState<'qif' | 'xhb' | 'json' | 'csv' | null>(null);
  const [csvRaw, setCsvRaw] = useState<CsvParseResult | null>(null);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvMapping, setCsvMapping] = useState<Partial<CsvMapping>>({});
  const [categoryMode, setCategoryMode] = useState<'file' | 'rules' | 'none'>('file');
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
  const [importErrors, setImportErrors] = useState<ImportErrors>(NO_IMPORT_ERRORS);

  const importMutation = useMutation({
    meta: { suppressGlobalError: true },
    mutationFn: importApi.executeStructured,
  });
  const jsonImportMutation = useMutation({
    meta: { suppressGlobalError: true },
    mutationFn: importApi.executeJsonFull,
  });

  const isXhb = parsedFile?.format === 'xhb';

  const makeDefaultAccChoice = useCallback(
    (name: string, initialBalance = 0): AccountChoice => ({
      action: 'create',
      name: name || t('import.new_account_default'),
      bank_id: banks[0]?.id ?? null,
      bank_name: banks[0]?.name ?? null,
      account_type_id: accountTypes[0]?.id ?? null,
      initial_balance: initialBalance,
      opening_date: null,
    }),
    [banks, accountTypes, t],
  );

  const handleFile = useCallback(
    (file: File) => {
      const nameLower = file.name.toLowerCase();
      const isQifFile = nameLower.endsWith('.qif');
      const isXhbFile = nameLower.endsWith('.xhb');
      const isJsonFile = nameLower.endsWith('.json');
      const isCsvFile = nameLower.endsWith('.csv');

      if (!isQifFile && !isXhbFile && !isJsonFile && !isCsvFile) {
        setParseError(t('import.err_extension'));
        return;
      }
      setParseError('');

      const handleJsonFile = (text: string): boolean => {
        const data = JSON.parse(text) as { version?: unknown; amounts_in_cents?: unknown };
        if (data.version !== '1.0' || data.amounts_in_cents !== true) {
          setParseError(t('import.err_json_invalid'));
          return false;
        }
        setParsedFile({ format: 'json', data });
        setSourceFormat('json');
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
        setSourceFormat('qif');
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
        setSourceFormat('xhb');
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

      const handleCsvFile = (text: string): boolean => {
        const result = parseCsvRaw(text);
        if (result.rows.length === 0) {
          setParseError(t('import.err_csv_no_rows'));
          return false;
        }
        const allValues = result.rows.flat();
        const numericValues = allValues.filter(
          (v) => /^-?[\d\s.,]+$/.test(v.trim()) && v.trim().length > 0,
        );
        const decimalSep = detectDecimalSeparator(numericValues);
        const hasIsoDates = allValues.some((v) => /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(v.trim()));
        const dateFormat = hasIsoDates ? 'YYYY-MM-DD' : 'DD/MM';
        setCsvRaw(result);
        setCsvRawText(text);
        setCsvMapping({ decimalSep, dateFormat });
        setSourceFormat('csv');
        setFileName(file.name);
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
          if (isCsvFile) {
            const ok = handleCsvFile(text);
            if (ok) setStep('columns');
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
    [categories, banks, accountTypes, paymentMethods, makeDefaultAccChoice, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const handleDelimiterChange = useCallback(
    (delimiter: string) => {
      setCsvRaw(parseCsvRaw(csvRawText, delimiter));
    },
    [csvRawText],
  );

  const handleColumnsNext = useCallback(
    (mapping: CsvMapping) => {
      if (!csvRaw) return;
      const accountName = fileName.replace(/\.[^.]+$/, '') || t('import.new_account_default');
      const ledger = buildLedgerFromCsv(csvRaw, mapping, accountName);
      if (ledger.transactions.length === 0) {
        setParseError(t('import.err_csv_no_rows'));
        return;
      }
      setParsedFile({ format: 'qif', data: ledger });
      setDateFormat(ledger.detectedDateFormat === 'MM/DD' ? 'MM/DD' : 'DD/MM');

      const accChoices = new Map<string, AccountChoice>();
      accChoices.set(accountName, makeDefaultAccChoice(accountName));
      setAccountChoices(accChoices);

      const catChoices = new Map<string, CategoryChoice>();
      for (const cat of ledger.uniqueCategories) {
        catChoices.set(cat, findAutoCategory(cat, categories) ?? { action: 'skip' });
      }
      setCategoryChoices(catChoices);
      setPaymodeChoices(new Map());
      setStep('accounts');
    },
    [csvRaw, fileName, categories, makeDefaultAccChoice, t],
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

  const rulesModeMatcher = useCallback(
    (description: string): number | null => {
      const rule = categorizationRules.find((r) => likeMatch(description, r.pattern));
      return rule ? rule.subcategory_id : null;
    },
    [categorizationRules],
  );

  let descriptionRuleMatcher: ((description: string) => number | null) | undefined;
  if (categoryMode === 'none') {
    descriptionRuleMatcher = noMatcher;
  } else if (categoryMode === 'rules') {
    descriptionRuleMatcher = rulesModeMatcher;
  }

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
        descriptionRuleMatcher,
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
    descriptionRuleMatcher,
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
    setImportErrors(NO_IMPORT_ERRORS);
    setStep('preview');
  };

  const handleImport = async () => {
    const body = buildExecuteBody(
      previewItems,
      selected,
      accountChoices,
      categoryChoices,
      t('import.no_description'),
    );
    const { txRows, tfRows } = buildRowIndex(previewItems, selected);
    setImportErrors(NO_IMPORT_ERRORS);
    try {
      await importMutation.mutateAsync(body);
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setStep('done');
    } catch (err) {
      // Erreurs de validation par champ → remontées sur les lignes de l'aperçu.
      if (err instanceof ApiError && err.body?.fields) {
        setImportErrors(mapImportErrors(err.body.fields, txRows, tfRows));
      }
    }
  };

  // Les index de ligne changent avec la sélection : on invalide les erreurs affichées.
  const clearImportErrors = () => setImportErrors(NO_IMPORT_ERRORS);

  const toggleItem = (i: number) => {
    clearImportErrors();
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  const selectAll = () => {
    clearImportErrors();
    const all = new Set<number>();
    previewItems.forEach((it, i) => {
      if (it.kind !== 'skip') all.add(i);
    });
    setSelected(all);
  };
  const deselectAll = () => {
    clearImportErrors();
    setSelected(new Set());
  };

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
    setSourceFormat(null);
    setCsvRaw(null);
    setCsvRawText('');
    setCsvMapping({});
    setFileName('');
    importMutation.reset();
    jsonImportMutation.reset();
  };

  return (
    <div className="max-w-4xl">
      <p className="text-sm text-content-subtle mb-8">{t('import.description')}</p>

      <StepIndicator step={step} format={sourceFormat} />

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

      {step === 'columns' && csvRaw && (
        <ColumnsStep
          csvRaw={csvRaw}
          mapping={csvMapping}
          onMappingChange={setCsvMapping}
          onDelimiterChange={handleDelimiterChange}
          onBack={() => setStep('upload')}
          onNext={handleColumnsNext}
        />
      )}

      {step === 'accounts' && parsedFile && (
        <AccountsStep
          parsedFile={parsedFile}
          fileName={fileName}
          sourceFormat={sourceFormat}
          dateFormat={dateFormat}
          onDateFormatChange={setDateFormat}
          accountsToMap={accountsToMap}
          qifTransferTargets={qifTransferTargets}
          accountChoices={accountChoices}
          setAccountChoice={setAccountChoice}
          activeAccounts={activeAccounts}
          accountTypes={accountTypes}
          banks={banks}
          logoMap={logoMap}
          onBack={() => setStep('upload')}
          onNext={() => setStep('categories')}
        />
      )}

      {step === 'categories' && parsedFile && (
        <>
          {!isXhb && (
            <div className="mb-6 p-4 rounded-xl border border-line-subtle bg-surface-muted">
              <p className="text-xs font-medium uppercase tracking-widest text-content-subtle mb-3">
                {t('import.category_mode_title')}
              </p>
              <div className="flex flex-col gap-2">
                {(['file', 'rules', 'none'] as const).map((mode) => (
                  <label
                    key={mode}
                    className="flex items-center gap-3 cursor-pointer text-sm text-content"
                  >
                    <input
                      type="radio"
                      name="categoryMode"
                      value={mode}
                      checked={categoryMode === mode}
                      onChange={() => setCategoryMode(mode)}
                      className="accent-brand-500"
                    />
                    {t(`import.category_mode_${mode}`)}
                  </label>
                ))}
              </div>
            </div>
          )}
          {categoryMode === 'file' || isXhb ? (
            <CategoriesStep
              uniqueCategories={uniqueCategories}
              categoryChoices={categoryChoices}
              setCategoryChoice={setCategoryChoice}
              categories={categories}
              isXhb={isXhb}
              onBack={() => setStep('accounts')}
              onNext={() => (isXhb ? setStep('paymethods') : goToPreview())}
            />
          ) : (
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep('accounts')}
                className="text-sm text-content-muted hover:text-content transition-colors"
              >
                ← {t('import.step_accounts')}
              </button>
              <button
                onClick={goToPreview}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
              >
                {t('import.step_preview')} →
              </button>
            </div>
          )}
        </>
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
          importErrors={importErrors}
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
