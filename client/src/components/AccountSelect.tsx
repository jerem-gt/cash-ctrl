import { useEffect, useMemo, useRef, useState } from 'react';

import { useClickOutside } from '@/hooks/useClickOutside';
import type { Account } from '@/types';

interface Props {
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
  if (bank) return <span className="w-4 h-4 rounded bg-stone-200 shrink-0 inline-block" />;
  return null;
}

export function AccountSelect({
  value,
  onChange,
  accounts,
  logoMap,
  placeholder = '— Choisir —',
}: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const ref = useClickOutside<HTMLDivElement>(() => {
    setOpen(false);
    setSearch('');
    setFocusedIndex(-1);
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = accounts.find((a) => String(a.id) === value) ?? null;
  const showSearch = accounts.length > 5;

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.bank ?? '').toLowerCase().includes(q),
    );
  }, [accounts, search]);

  const groups = useMemo(() => {
    const groupMap = new Map<string, Account[]>();
    for (const acc of filtered) {
      const key = acc.bank ?? '';
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(acc);
    }
    return [...groupMap.entries()]
      .sort(([a], [b]) => {
        if (a === '') return 1;
        if (b === '') return -1;
        return a.localeCompare(b);
      })
      .map(([bank, accs]) => ({ bank: bank || null, accounts: accs }));
  }, [filtered]);

  const flatAccounts = useMemo(() => groups.flatMap((g) => g.accounts), [groups]);
  const totalOptions = 1 + flatAccounts.length;

  useEffect(() => {
    if (open && showSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, showSearch]);

  useEffect(() => {
    if (focusedIndex >= 0) itemRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  const close = () => {
    setOpen(false);
    setSearch('');
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
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

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(0);
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, index: number) => {
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

  const handleBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
  };

  return (
    <div ref={ref} className="relative" onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all text-left"
      >
        {selected ? (
          <>
            <Logo bank={selected.bank} logoMap={logoMap} />
            <span className="flex-1 truncate">{selected.name}</span>
            {selected.bank && (
              <span className="text-stone-400 text-xs shrink-0">({selected.bank})</span>
            )}
          </>
        ) : (
          <span className="flex-1 text-stone-400">{placeholder}</span>
        )}
        <span className="text-stone-300 text-xs">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 w-full bg-white border border-black/[0.09] rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto"
        >
          {showSearch && (
            <div className="px-2 pb-1 border-b border-black/[0.06]">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Rechercher…"
                className="w-full px-2 py-1.5 text-sm bg-stone-50 rounded outline-none focus:bg-white transition-colors"
              />
            </div>
          )}

          <button
            ref={(el) => {
              itemRefs.current[0] = el;
            }}
            type="button"
            role="option"
            aria-selected={value === ''}
            onClick={() => handleSelect('')}
            onKeyDown={(e) => handleItemKeyDown(e, 0)}
            className="w-full flex items-center px-3 py-2 text-sm text-stone-400 hover:bg-stone-50 focus:bg-stone-50 outline-none transition-colors text-left"
          >
            {placeholder}
          </button>

          {groups.map((group) => (
            <div key={group.bank ?? '__none__'}>
              {groups.length > 1 && (
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-widest text-stone-400 select-none">
                  {group.bank ?? 'Sans banque'}
                </p>
              )}
              {group.accounts.map((a) => {
                const index = 1 + flatAccounts.findIndex((fa) => fa.id === a.id);
                return (
                  <button
                    key={a.id}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={String(a.id) === value}
                    onClick={() => handleSelect(String(a.id))}
                    onKeyDown={(e) => handleItemKeyDown(e, index)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-50 focus:bg-stone-50 outline-none transition-colors text-left ${String(a.id) === value ? 'bg-stone-50 font-medium' : ''}`}
                  >
                    <Logo bank={a.bank} logoMap={logoMap} />
                    <span className="flex-1 truncate">{a.name}</span>
                    {a.bank && groups.length <= 1 && (
                      <span className="text-stone-400 text-xs shrink-0">({a.bank})</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-stone-400 italic">Aucun résultat</p>
          )}
        </div>
      )}
    </div>
  );
}
