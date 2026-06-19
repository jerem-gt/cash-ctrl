import type { Bank } from '@cashctrl/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useClickOutside } from '@/hooks/useClickOutside';

interface Props {
  value: string;
  onChange: (value: string) => void;
  banks: Bank[];
  error?: boolean;
}

export function BankSelect({ value, onChange, banks, error = false }: Readonly<Props>) {
  const { t } = useTranslation('accounts');
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const selected = banks.find((b) => String(b.id) === value) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t('bank_select.aria_label')}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm bg-surface-muted border rounded-lg outline-none focus:border-brand-500 transition-all text-left ${error ? 'border-danger' : 'border-line'}`}
      >
        {selected ? (
          <>
            {selected.logo ? (
              <img
                src={selected.logo}
                alt=""
                className="w-4 h-4 object-contain rounded shrink-0"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            ) : (
              <span className="w-4 h-4 rounded bg-surface-strong shrink-0 inline-block" />
            )}
            <span className="flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-content-subtle">{t('bank_select.choose')}</span>
        )}
        <span className="text-content-faint text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-line-subtle rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="w-full flex items-center px-3 py-2 text-sm text-content-subtle hover:bg-surface-muted transition-colors text-left"
          >
            {t('bank_select.choose')}
          </button>
          {banks.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                onChange(String(b.id));
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted transition-colors text-left ${String(b.id) === value ? 'bg-surface-muted font-medium' : ''}`}
            >
              {b.logo ? (
                <img
                  src={b.logo}
                  alt=""
                  className="w-4 h-4 object-contain rounded shrink-0"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ) : (
                <span className="w-4 h-4 rounded bg-surface-strong shrink-0 inline-block" />
              )}
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
