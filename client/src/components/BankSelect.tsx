import { useState } from 'react';
import type { Bank } from '@/types';
import { useClickOutside } from '@/hooks/useClickOutside';

interface Props {
  value: string;
  onChange: (value: string) => void;
  banks: Bank[];
}

export function BankSelect({ value, onChange, banks }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const selected = banks.find(b => String(b.id) === value) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all text-left"
      >
        {selected ? (
          <>
            {selected.logo
              ? <img src={selected.logo} alt="" className="w-4 h-4 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
              : <span className="w-4 h-4 rounded bg-stone-200 shrink-0 inline-block" />
            }
            <span className="flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-stone-400">— Choisir —</span>
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
            — Choisir —
          </button>
          {banks.map(b => (
            <button
              key={b.id}
              type="button"
              onClick={() => { onChange(String(b.id)); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-50 transition-colors text-left ${String(b.id) === value ? 'bg-stone-50 font-medium' : ''}`}
            >
              {b.logo
                ? <img src={b.logo} alt="" className="w-4 h-4 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
                : <span className="w-4 h-4 rounded bg-stone-200 shrink-0 inline-block" />
              }
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
