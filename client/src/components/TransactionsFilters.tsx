import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AccountSelect } from '@/components/AccountSelect.tsx';
import { DecimalInput, Input, Select } from '@/components/ui';
import { Account, Category, Filters, PaymentMethod, Subcategory } from '@/types.ts';

interface FilterProps {
  filters: Filters;
  onFilterChange: (patch: Partial<Filters>) => void;
  categories: Category[];
  subcategories: Subcategory[];
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  logoMap: Record<string, string | null>;
  showAccountSelect?: boolean;
}

const ADVANCED_KEYS: (keyof Filters)[] = [
  'account_id',
  'category_id',
  'subcategory_id',
  'date_from',
  'date_to',
  'amount_min',
  'amount_max',
  'payment_method_id',
  'validated',
];

export const TransactionsFilters = ({
  filters,
  onFilterChange,
  categories,
  subcategories,
  accounts,
  paymentMethods,
  logoMap,
  showAccountSelect,
}: FilterProps) => {
  const [descriptionInput, setDescriptionInput] = useState(filters.description_contains ?? '');
  const [amountMinInput, setAmountMinInput] = useState(filters.amount_min?.toString() ?? '');
  const [amountMaxInput, setAmountMaxInput] = useState(filters.amount_max?.toString() ?? '');
  const [open, setOpen] = useState(false);

  const activeAdvancedCount = ADVANCED_KEYS.filter((k) => {
    if (!showAccountSelect && k === 'account_id') return false;
    return filters[k] != null;
  }).length;

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = descriptionInput.trim();
      const current = filters.description_contains ?? '';
      if (trimmed !== current) {
        onFilterChange({ description_contains: trimmed || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [descriptionInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
      const val = Number.parseFloat(amountMinInput);
      const current = filters.amount_min;
      const next = amountMinInput.trim() && !Number.isNaN(val) ? val : undefined;
      if (next !== current) onFilterChange({ amount_min: next });
    }, 400);
    return () => clearTimeout(timer);
  }, [amountMinInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
      const val = Number.parseFloat(amountMaxInput);
      const current = filters.amount_max;
      const next = amountMaxInput.trim() && !Number.isNaN(val) ? val : undefined;
      if (next !== current) onFilterChange({ amount_max: next });
    }, 400);
    return () => clearTimeout(timer);
  }, [amountMaxInput]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Barre principale */}
      <div className="flex gap-3 flex-wrap items-center w-full">
        <div className="relative flex-1 min-w-40 max-w-72">
          <Input
            type="text"
            placeholder="Rechercher une description…"
            value={descriptionInput}
            onChange={(e) => setDescriptionInput(e.target.value)}
            className={`h-9${descriptionInput ? ' pr-8' : ''}`}
          />
          {descriptionInput && (
            <button
              type="button"
              onClick={() => {
                setDescriptionInput('');
                onFilterChange({ description_contains: undefined });
              }}
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <Select
          aria-label="Choisir un type"
          className="flex-1 min-w-32 max-w-44"
          value={filters.type ?? ''}
          onChange={(e) =>
            onFilterChange({
              type: (e.target.value || undefined) as 'income' | 'expense' | undefined,
            })
          }
        >
          <option value="">Tous types</option>
          <option value="income">Revenus</option>
          <option value="expense">Dépenses</option>
        </Select>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-stone-200 bg-white text-sm text-stone-600 hover:bg-stone-50 transition-colors shrink-0"
        >
          Filtres avancés
          {activeAdvancedCount > 0 && (
            <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-stone-700 text-white text-[10px] font-medium leading-none">
              {activeAdvancedCount}
            </span>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Section avancée */}
      {open && (
        <div className="flex gap-3 flex-wrap items-center pt-1 border-t border-stone-100">
          {showAccountSelect && (
            <div className="flex-1 min-w-44 max-w-64">
              <AccountSelect
                id="filtered-account-select"
                value={String(filters.account_id ?? '')}
                onChange={(v) => onFilterChange({ account_id: v ? Number.parseInt(v) : undefined })}
                accounts={accounts}
                logoMap={logoMap}
                placeholder="Tous les comptes"
              />
            </div>
          )}

          <Select
            aria-label="Choisir une catégorie"
            className="flex-1 min-w-32 max-w-50"
            value={String(filters.category_id ?? '')}
            onChange={(e) =>
              onFilterChange({
                category_id: e.target.value ? Number.parseInt(e.target.value) : undefined,
                subcategory_id: undefined,
              })
            }
          >
            <option value="">Toutes catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Choisir une sous-catégorie"
            disabled={!filters.category_id}
            className="flex-1 min-w-32 max-w-50 disabled:opacity-50 disabled:cursor-not-allowed"
            value={String(filters.subcategory_id ?? '')}
            onChange={(e) =>
              onFilterChange({
                subcategory_id: e.target.value ? Number.parseInt(e.target.value) : undefined,
              })
            }
          >
            <option value="">Toutes sous-catégories</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={String(sub.id)}>
                {sub.name}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            aria-label="Date de début"
            className="flex-1 min-w-32 max-w-40 h-9"
            value={filters.date_from ?? ''}
            onChange={(e) => onFilterChange({ date_from: e.target.value || undefined })}
          />

          <Input
            type="date"
            aria-label="Date de fin"
            className="flex-1 min-w-32 max-w-40 h-9"
            value={filters.date_to ?? ''}
            onChange={(e) => onFilterChange({ date_to: e.target.value || undefined })}
          />

          <DecimalInput
            placeholder="Montant min €"
            aria-label="Montant minimum"
            className="flex-1 min-w-28 max-w-36 h-9"
            value={amountMinInput}
            onChange={(e) => setAmountMinInput(e.target.value)}
          />

          <DecimalInput
            placeholder="Montant max €"
            aria-label="Montant maximum"
            className="flex-1 min-w-28 max-w-36 h-9"
            value={amountMaxInput}
            onChange={(e) => setAmountMaxInput(e.target.value)}
          />

          <Select
            aria-label="Choisir un moyen de paiement"
            className="flex-1 min-w-36 max-w-52"
            value={String(filters.payment_method_id ?? '')}
            onChange={(e) =>
              onFilterChange({
                payment_method_id: e.target.value ? Number.parseInt(e.target.value) : undefined,
              })
            }
          >
            <option value="">Tous moyens de paiement</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={String(pm.id)}>
                {pm.name}
              </option>
            ))}
          </Select>

          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              className="w-4 h-4 accent-stone-700 cursor-pointer"
              checked={filters.validated === false}
              onChange={(e) => onFilterChange({ validated: e.target.checked ? false : undefined })}
            />
            <span>Non validées seulement</span>
          </label>
        </div>
      )}
    </div>
  );
};
