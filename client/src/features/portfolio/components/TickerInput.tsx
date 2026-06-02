import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui';
import { useStockSearch } from '@/features/portfolio/hooks/useStocks';

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
  const { t } = useTranslation('portfolio');
  const showDropdown = isIsin(value) && !disabled;
  const { data: searchResults = [], isFetching: isSearching } = useStockSearch(value.trim());

  let dropdownContent: ReactNode;
  if (isSearching) {
    dropdownContent = (
      <div className="px-3 py-2.5 text-sm text-content-subtle">{t('ticker_input.searching')}</div>
    );
  } else if (searchResults.length === 0) {
    dropdownContent = (
      <div className="px-3 py-2.5 text-sm text-content-subtle">{t('ticker_input.no_result')}</div>
    );
  } else {
    dropdownContent = searchResults.map((r) => (
      <button
        type="button"
        key={r.symbol}
        onClick={() => onChange(r.symbol)}
        className="w-full text-left px-3 py-2.5 hover:bg-surface-muted transition-colors border-b border-line-subtle last:border-0 flex items-baseline gap-2"
      >
        <span className="font-mono font-bold text-sm text-content">{r.symbol}</span>
        <span className="text-xs text-content-muted truncate">{r.name}</span>
        <span className="text-[10px] text-content-faint shrink-0 ml-auto">{r.exchange}</span>
      </button>
    ));
  }

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
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-line rounded-xl shadow-lg z-10 overflow-hidden">
          {dropdownContent}
        </div>
      )}
    </div>
  );
}
