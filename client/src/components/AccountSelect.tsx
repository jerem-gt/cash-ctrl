import { useState } from 'react';
import type { Account } from '@/types';
import { useClickOutside } from '@/hooks/useClickOutside';

interface Props {
  value: string;
  onChange: (value: string) => void;
  accounts: Account[];
  logoMap: Record<string, string | null>;
  placeholder?: string;
}

function Logo({ bank, logoMap }: Readonly<{ bank?: string; logoMap: Record<string, string | null> }>) {
  const logo = bank ? (logoMap[bank] ?? null) : null;
  if (logo) return <img src={logo} alt="" className="w-4 h-4 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />;
  if (bank) return <span className="w-4 h-4 rounded bg-stone-200 shrink-0 inline-block" />;
  return null;
}

export function AccountSelect({ value, onChange, accounts, logoMap, placeholder = '— Choisir —' }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const selected = accounts.find(a => String(a.id) === value) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all text-left"
      >
        {selected ? (
          <>
            <Logo bank={selected.bank} logoMap={logoMap} />
            <span className="flex-1 truncate">{selected.name}</span>
            {selected.bank && <span className="text-stone-400 text-xs shrink-0">({selected.bank})</span>}
          </>
        ) : (
          <span className="flex-1 text-stone-400">{placeholder}</span>
        )}
        <span className="text-stone-300 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-black/[0.09] rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="w-full flex items-center px-3 py-2 text-sm text-stone-400 hover:bg-stone-50 transition-colors text-left"
          >
            {placeholder}
          </button>
          {accounts.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => { onChange(String(a.id)); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-50 transition-colors text-left ${String(a.id) === value ? 'bg-stone-50 font-medium' : ''}`}
            >
              <Logo bank={a.bank} logoMap={logoMap} />
              <span className="flex-1 truncate">{a.name}</span>
              {a.bank && <span className="text-stone-400 text-xs shrink-0">({a.bank})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
