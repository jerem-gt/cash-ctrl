import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import { importApi } from '@/api/client';
import { Button, Card, Select } from '@/components/ui';
import { useAccounts } from '@/hooks/useAccounts';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useBanks } from '@/hooks/useBanks';
import { useCategories } from '@/hooks/useCategories';
import { fmtDate } from '@/lib/format';
import { parseQif, type QifParseResult } from '@/lib/qif-parser';
import type { Account, AccountType, Bank, Category } from '@/types';

import {
  type AccountChoice,
  buildExecuteBody,
  type CategoryChoice,
  findAutoCategory,
  resolvePreview,
} from './import.helpers';

type Step = 'upload' | 'accounts' | 'categories' | 'preview' | 'done';

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: Readonly<{ step: Step }>) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload', label: 'Fichier' },
    { id: 'accounts', label: 'Comptes' },
    { id: 'categories', label: 'Catégories' },
    { id: 'preview', label: 'Aperçu' },
    { id: 'done', label: 'Terminé' },
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
    active: 'bg-stone-200', // ligne après l'actif
    completed: 'bg-stone-400',
    upcoming: 'bg-stone-200',
  };
  const getStatus = (index: number, current: number) => {
    if (index === current) return 'active';
    if (index < current) return 'completed';
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
        account_type_id: accountTypes[0]?.id ?? null,
        initial_balance: 0,
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
            <option value="skip">Ignorer</option>
            <option value="map">Mapper →</option>
            <option value="create">Créer</option>
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
                  Nom du compte
                </span>
                <input
                  className="flex-1 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
                  value={choice.name}
                  onChange={(e) => onChange({ ...choice, name: e.target.value })}
                  placeholder="Nom du compte"
                />
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-stone-400 shrink-0 w-24 text-right">Banque</span>
                <Select
                  className="flex-1"
                  value={choice.bank_id ?? ''}
                  onChange={(e) =>
                    onChange({ ...choice, bank_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">— aucune —</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-stone-400 shrink-0 w-24 text-right">Type</span>
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
                  <option value="">— aucun —</option>
                  {accountTypes.map((at) => (
                    <option key={at.id} value={at.id}>
                      {at.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-stone-400 shrink-0 w-24 text-right">
                  Solde initial
                </span>
                <input
                  type="number"
                  className="flex-1 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
                  value={choice.initial_balance}
                  onChange={(e) => onChange({ ...choice, initial_balance: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-stone-400 shrink-0 w-24 text-right">
                  Date ouverture
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
  const parts = qifCategory.split(':');
  const [defaultSubcatName] = [...parts].reverse();
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
            <option value="skip">Ignorer</option>
            <option value="map">Mapper →</option>
            <option value="create">Créer</option>
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
                <span className="text-xs text-stone-400">Sous-catégorie</span>
                <input
                  className="w-40 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
                  value={choice.subcategory_name}
                  onChange={(e) => onChange({ ...choice, subcategory_name: e.target.value })}
                  placeholder="Nom sous-catégorie"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">Catégorie parente</span>
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
                  <option value="__new__">+ Nouvelle catégorie…</option>
                </Select>
              </div>
              {choice.existing_category_id === null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">Nom catégorie</span>
                  <input
                    className="w-40 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
                    value={choice.new_category_name}
                    onChange={(e) => onChange({ ...choice, new_category_name: e.target.value })}
                    placeholder="Nouvelle catégorie"
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImportPage() {
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const activeAccounts = accounts.filter((a) => !a.closed_at);

  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<QifParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [dateFormat, setDateFormat] = useState<'MM/DD' | 'DD/MM'>('DD/MM');
  const [accountChoices, setAccountChoices] = useState<Map<string, AccountChoice>>(new Map());
  const [categoryChoices, setCategoryChoices] = useState<Map<string, CategoryChoice>>(new Map());

  const setAccountChoice = useCallback((qifName: string, c: AccountChoice) => {
    setAccountChoices((prev) => new Map(prev).set(qifName, c));
  }, []);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({ mutationFn: importApi.executeQif });

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.qif')) {
        setParseError("Le fichier doit avoir l'extension .qif");
        return;
      }
      setParseError('');
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = parseQif(e.target?.result as string);
          if (result.transactions.length === 0) {
            setParseError('Aucune transaction trouvée dans ce fichier.');
            return;
          }
          setParsed(result);
          setFileName(file.name);
          setDateFormat(result.detectedDateFormat === 'MM/DD' ? 'MM/DD' : 'DD/MM');

          const makeDefaultAccChoice = (qifName: string): AccountChoice => ({
            action: 'create',
            name: qifName || 'Nouveau compte',
            bank_id: banks[0]?.id ?? null,
            account_type_id: accountTypes[0]?.id ?? null,
            initial_balance: 0,
            opening_date: null,
          });
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
          setStep('accounts');
        } catch {
          setParseError('Erreur lors de la lecture du fichier QIF.');
        }
      };
      reader.readAsText(file, 'UTF-8');
    },
    [activeAccounts, categories, banks, accountTypes],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const previewItems = useMemo(
    () =>
      parsed
        ? resolvePreview(
            parsed,
            dateFormat,
            accountChoices,
            categoryChoices,
            activeAccounts,
            categories,
          )
        : [],
    [parsed, dateFormat, accountChoices, categoryChoices, activeAccounts, categories],
  );

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
      if (n.has(i)) {
        n.delete(i);
      } else {
        n.add(i);
      }
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

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif text-3xl text-stone-800 mb-1">Importation QIF</h1>
      <p className="text-sm text-stone-400 mb-8">
        Importez des transactions depuis un fichier Quicken Interchange Format.
      </p>

      <StepIndicator step={step} />

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
            <p className="text-sm font-medium text-stone-600 mb-1">Déposez votre fichier QIF ici</p>
            <p className="text-xs text-stone-400">ou cliquez pour parcourir</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".qif"
              className="sr-only"
              aria-label="Sélectionner un fichier QIF"
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
      {step === 'accounts' && parsed && (
        <div className="flex flex-col gap-6">
          <Card>
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-4">
              Fichier chargé
            </p>
            <div className="flex gap-6 text-sm text-stone-600">
              <span className="font-medium text-stone-800">{fileName}</span>
              <span>{parsed.transactions.length} transactions</span>
              <span>{parsed.uniqueCategories.length} catégories</span>
              {parsed.uniqueTransferTargets.length > 0 && (
                <span>{parsed.uniqueTransferTargets.length} compte(s) de virement</span>
              )}
            </div>
          </Card>

          <Card>
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
              Format de date
            </p>
            <p className="text-xs text-stone-400 mb-3">
              Détecté :{' '}
              <strong>
                {parsed.detectedDateFormat === 'ambiguous'
                  ? 'ambigu — vérifiez'
                  : parsed.detectedDateFormat}
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

          <Card>
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
              Mapping des comptes
            </p>
            <p className="text-xs text-stone-400 mb-4">
              Associez chaque compte QIF à un compte existant, créez-en un nouveau, ou ignorez-le.
              Les virements vers des comptes ignorés seront exclus.
            </p>
            {parsed.accounts.map((qifName) => (
              <AccountMappingRow
                key={qifName}
                qifName={qifName}
                choice={accountChoices.get(qifName)}
                accounts={activeAccounts}
                accountTypes={accountTypes}
                banks={banks}
                onChange={(c) => setAccountChoice(qifName, c)}
              />
            ))}
            {(() => {
              const transferTargets = parsed.uniqueTransferTargets.filter(
                (t) => !parsed.accounts.includes(t),
              );
              if (transferTargets.length === 0) return null;
              return (
                <>
                  <p className="text-xs text-stone-400 mt-4 mb-1 pt-3 border-t border-stone-100">
                    Comptes de virement détectés (non présents dans le fichier)
                  </p>
                  {transferTargets.map((qifName) => (
                    <AccountMappingRow
                      key={qifName}
                      qifName={qifName}
                      choice={accountChoices.get(qifName)}
                      accounts={activeAccounts}
                      accountTypes={accountTypes}
                      banks={banks}
                      onChange={(c) => setAccountChoice(qifName, c)}
                    />
                  ))}
                </>
              );
            })()}
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setStep('upload')}>← Retour</Button>
            <Button variant="primary" onClick={() => setStep('categories')}>
              Catégories →
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Categories ── */}
      {step === 'categories' && parsed && (
        <div className="flex flex-col gap-6">
          <Card>
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
              Mapping des catégories
            </p>
            <p className="text-xs text-stone-400 mb-4">
              Mappez, créez ou ignorez chaque catégorie QIF trouvée dans le fichier.
            </p>
            {parsed.uniqueCategories.length === 0 ? (
              <p className="text-sm text-stone-400 py-4 text-center">
                Aucune catégorie dans ce fichier.
              </p>
            ) : (
              parsed.uniqueCategories.map((qifCat) => (
                <CategoryMappingRow
                  key={qifCat}
                  qifCategory={qifCat}
                  choice={categoryChoices.get(qifCat)}
                  categories={categories}
                  onChange={(c) => setCategoryChoices((prev) => new Map(prev).set(qifCat, c))}
                />
              ))
            )}
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setStep('accounts')}>← Retour</Button>
            <Button variant="primary" onClick={goToPreview}>
              Aperçu →
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Preview ── */}
      {step === 'preview' && (
        <div className="flex flex-col gap-6">
          <div className="flex gap-4">
            {[
              { value: selectedTxCount, label: 'transactions' },
              { value: selectedTfCount, label: 'virements' },
              { value: skippedCount, label: 'ignorées' },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="flex-1 bg-white border border-black/[0.07] rounded-2xl p-4 shadow-sm text-center"
              >
                <p className="text-2xl font-serif text-stone-800">{value}</p>
                <p className="text-xs text-stone-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
                Transactions ({importableCount} importables, {skippedCount} ignorées)
              </p>
              <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === importableCount && importableCount > 0}
                  onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
                  className="rounded"
                />
                <span>Tout sélectionner</span>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-stone-400 border-b border-stone-100">
                    <th className="pb-2 w-6" />
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Description</th>
                    <th className="pb-2 pr-3">Compte</th>
                    <th className="pb-2 pr-3">Catégorie</th>
                    <th className="pb-2 text-right">Montant</th>
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
                            {item.fromAccountName} → {item.toAccountName}
                          </td>
                          <td className="py-1.5 pr-3 text-stone-400 italic">virement</td>
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
                        <td className="py-1.5 pr-3 text-stone-600">{item.accountName}</td>
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
              <p className="font-medium mb-1">Erreur lors de l'importation :</p>
              <ul className="list-disc list-inside space-y-0.5">
                {importMutation.error.message.split('\n').map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between">
            <Button onClick={() => setStep('categories')}>← Retour</Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={selected.size === 0 || importMutation.isPending}
            >
              {importMutation.isPending ? 'Importation…' : `Importer ${selected.size} éléments`}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 5: Done ── */}
      {step === 'done' && importMutation.data && (
        <Card>
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✓</div>
            <h2 className="font-serif text-2xl text-stone-800 mb-2">Importation terminée</h2>
            <div className="flex justify-center gap-8 mt-6 mb-8">
              <div>
                <p className="text-3xl font-serif text-stone-800">
                  {importMutation.data.transactions}
                </p>
                <p className="text-xs text-stone-400 mt-1">transactions importées</p>
              </div>
              <div>
                <p className="text-3xl font-serif text-stone-800">
                  {importMutation.data.transfers}
                </p>
                <p className="text-xs text-stone-400 mt-1">virements importés</p>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => {
                  setStep('upload');
                  setParsed(null);
                  setFileName('');
                  importMutation.reset();
                }}
              >
                Nouvelle importation
              </Button>
              <Button
                variant="primary"
                onClick={() => (globalThis.location.href = '/transactions')}
              >
                Voir les transactions
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
