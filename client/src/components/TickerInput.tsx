import { useStockSearch } from '@/hooks/useStocks';

import { Input } from './ui';

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{10}$/i;

export function isIsin(value: string): boolean {
  return ISIN_REGEX.test(value.trim());
}

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function TickerInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  autoFocus,
  className,
}: Readonly<Props>) {
  const showDropdown = isIsin(value) && !disabled;
  const { data: searchResults = [], isFetching: isSearching } = useStockSearch(value.trim());

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
      />

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-10 overflow-hidden">
          {isSearching ? (
            <div className="px-3 py-2.5 text-sm text-stone-400">Recherche en cours…</div>
          ) : searchResults.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-stone-400">Aucun résultat</div>
          ) : (
            searchResults.map((r) => (
              <button
                type="button"
                key={r.symbol}
                onClick={() => onChange(r.symbol)}
                className="w-full text-left px-3 py-2.5 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0 flex items-baseline gap-2"
              >
                <span className="font-mono font-bold text-sm text-stone-900">{r.symbol}</span>
                <span className="text-xs text-stone-500 truncate">{r.name}</span>
                <span className="text-[10px] text-stone-300 shrink-0 ml-auto">{r.exchange}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
