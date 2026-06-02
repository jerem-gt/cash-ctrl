import { ChevronDown } from 'lucide-react';
import { type FocusEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClickOutside } from '@/features/accounts/hooks/useClickOutside';
import { useBanks } from '@/hooks/useBanks';
import { bankSortOrderMap, groupAccountsByBank } from '@/lib/account';
import type { Account } from '@/types';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  accounts: Account[];
  logoMap: Record<string, string | null>;
  placeholder?: string;
}

function Logo({
  bank,
  logoMap,
}: Readonly<{ bank?: string; logoMap: Record<string, string | null> }>) {
  const logo = bank ? (logoMap[bank] ?? null) : null;
  if (logo)
    return (
      <img
        src={logo}
        alt=""
        className="w-4 h-4 object-contain rounded shrink-0"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    );
  if (bank) return <span className="w-4 h-4 rounded bg-surface-strong shrink-0 inline-block" />;
  return null;
}

export function AccountSelect({
  id,
  value,
  onChange,
  accounts,
  logoMap,
  placeholder,
}: Readonly<Props>) {
  const { t } = useTranslation('accounts');
  const resolvedPlaceholder = placeholder ?? t('bank_select.choose');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const { data: banks = [] } = useBanks();
  const bankOrderMap = useMemo(() => bankSortOrderMap(banks), [banks]);

  const ref = useClickOutside<HTMLDivElement>(() => {
    setOpen(false);
    setSearch('');
    setFocusedIndex(-1);
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = accounts.find((a) => String(a.id) === value) ?? null;
  const showSearch = accounts.length > 5;

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.bank ?? '').toLowerCase().includes(q),
    );
  }, [accounts, search]);

  const groups = useMemo(
    () => groupAccountsByBank(filtered, bankOrderMap),
    [filtered, bankOrderMap],
  );

  const flatAccounts = useMemo(() => groups.flatMap((g) => g.accounts), [groups]);
  const totalOptions = 1 + flatAccounts.length;

  useEffect(() => {
    if (open && showSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, showSearch]);

  useEffect(() => {
    if (focusedIndex >= 0) itemsRef.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  const close = () => {
    setOpen(false);
    setSearch('');
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) close();
      else setOpen(true);
    } else if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setFocusedIndex(0);
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(0);
    }
  };

  const handleItemKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (index < totalOptions - 1) setFocusedIndex(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) setFocusedIndex(index - 1);
      else if (showSearch) searchRef.current?.focus();
      else triggerRef.current?.focus();
    } else if (e.key === 'Escape') close();
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
    setFocusedIndex(-1);
  };

  const handleBlur = (e: FocusEvent) => {
    if (!ref.current?.contains(e.relatedTarget)) close();
  };

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
        onKeyDown={handleTriggerKeyDown}
        onBlur={handleBlur}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full h-9 flex items-center gap-2 px-3 py-2 text-sm bg-surface border border-line rounded-lg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all text-left"
      >
        {selected ? (
          <>
            <Logo bank={selected.bank} logoMap={logoMap} />
            <span className="flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1">{resolvedPlaceholder}</span>
        )}
        <ChevronDown size={16} />
      </button>

      {open && (
        <div
          role="listbox"
          onBlur={handleBlur}
          className="absolute z-20 mt-1 w-full bg-surface border border-line-subtle rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto"
        >
          {showSearch && (
            <div className="px-2 pb-1 border-b border-line-subtle">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('select.search_placeholder')}
                className="w-full px-2 py-1.5 text-sm bg-surface-muted rounded outline-none focus:bg-surface transition-colors"
              />
            </div>
          )}

          <button
            ref={(el) => {
              itemsRef.current[0] = el;
            }}
            type="button"
            role="option"
            aria-selected={value === ''}
            onClick={() => handleSelect('')}
            onKeyDown={(e) => handleItemKeyDown(e, 0)}
            className="w-full flex items-center px-3 py-2 text-sm text-content-subtle hover:bg-surface-muted focus:bg-surface-muted outline-none transition-colors text-left"
          >
            {resolvedPlaceholder}
          </button>

          {groups.map((group) => (
            <div key={group.bank ?? '__none__'}>
              {groups.length > 1 && (
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-widest text-content-subtle select-none">
                  {group.bank ?? t('select.no_bank')}
                </p>
              )}
              {group.accounts.map((a) => {
                const index = 1 + flatAccounts.findIndex((fa) => fa.id === a.id);
                return (
                  <button
                    key={a.id}
                    ref={(el) => {
                      itemsRef.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={String(a.id) === value}
                    onClick={() => handleSelect(String(a.id))}
                    onKeyDown={(e) => handleItemKeyDown(e, index)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted focus:bg-surface-muted outline-none transition-colors text-left ${String(a.id) === value ? 'bg-surface-muted font-medium' : ''}`}
                  >
                    <Logo bank={a.bank} logoMap={logoMap} />
                    <span className="flex-1 truncate">{a.name}</span>
                    {a.bank && groups.length <= 1 && (
                      <span className="text-content-subtle text-xs shrink-0">({a.bank})</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-content-subtle italic">{t('select.no_result')}</p>
          )}
        </div>
      )}
    </div>
  );
}
