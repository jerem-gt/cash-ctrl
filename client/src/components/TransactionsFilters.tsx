import { useEffect, useState } from 'react';

import { AccountSelect } from '@/components/AccountSelect.tsx';
import { Input, Select } from '@/components/ui.tsx';
import { Account, Category, Filters, Subcategory } from '@/types.ts';

interface FilterProps {
  filters: Filters;
  onFilterChange: (patch: Partial<Filters>) => void;
  categories: Category[];
  subcategories: Subcategory[];
  accounts: Account[];
  logoMap: Record<string, string | null>;
  showAccountSelect?: boolean;
}

export const TransactionsFilters = ({
  filters,
  onFilterChange,
  categories,
  subcategories,
  accounts,
  logoMap,
  showAccountSelect,
}: FilterProps) => {
  const [descriptionInput, setDescriptionInput] = useState(filters.description_contains ?? '');

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

  return (
    <>
      {showAccountSelect && (
        <div className="flex-1 min-w-32.5 max-w-50">
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

      <div className="flex-1 min-w-40 max-w-64">
        <Input
          type="search"
          placeholder="Rechercher une description…"
          value={descriptionInput}
          onChange={(e) => setDescriptionInput(e.target.value)}
          className="h-9"
        />
      </div>

      <Select
        aria-label="Choisir une catégorie"
        className="flex-1 min-w-32.5 max-w-50"
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
        className="flex-1 min-w-32.5 max-w-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
      <Select
        aria-label="Choisir un type"
        className="flex-1 min-w-32.5 max-w-50"
        value={filters.type ?? ''}
        onChange={(e) =>
          onFilterChange({ type: (e.target.value || undefined) as 'income' | 'expense' | undefined })
        }
      >
        <option value="">Tous types</option>
        <option value="income">Revenus</option>
        <option value="expense">Dépenses</option>
      </Select>
    </>
  );
};
