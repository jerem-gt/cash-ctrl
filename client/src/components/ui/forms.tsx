import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { addDays } from '@/lib/dateUtils';

// ─── DateInput ────────────────────────────────────────────────────────────────
interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  error?: boolean;
  disabled?: boolean;
}
export function DateInput({
  value,
  onChange,
  id,
  error = false,
  disabled,
}: Readonly<DateInputProps>) {
  const { t } = useTranslation('common');
  const borderClass = error
    ? 'border-danger focus-within:ring-danger/20'
    : 'border-line focus-within:border-brand-500 focus-within:ring-brand-500/20';
  const stepClass =
    'flex w-10 shrink-0 items-center justify-center border-line text-content-secondary transition-colors hover:bg-surface-emphasis focus-visible:outline-none focus-visible:bg-surface-emphasis disabled:cursor-not-allowed';
  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-lg border bg-surface-muted transition-all focus-within:ring-1 has-disabled:opacity-60 ${borderClass}`}
    >
      <button
        type="button"
        aria-label={t('date_prev_day')}
        title={t('date_prev_day')}
        disabled={disabled}
        onClick={() => onChange(addDays(value, -1))}
        className={`${stepClass} border-r`}
      >
        <Minus size={16} />
      </button>
      <input
        id={id}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 px-3 py-2 text-sm bg-transparent outline-none disabled:cursor-not-allowed"
      />
      <button
        type="button"
        aria-label={t('date_next_day')}
        title={t('date_next_day')}
        disabled={disabled}
        onClick={() => onChange(addDays(value, 1))}
        className={`${stepClass} border-l`}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

// ─── FormGroup ────────────────────────────────────────────────────────────────
export function FormGroup({
  label,
  htmlFor,
  className = '',
  optional = false,
  children,
}: Readonly<{
  label: string;
  htmlFor?: string;
  className?: string;
  optional?: boolean;
  children: ReactNode;
}>) {
  const { t } = useTranslation('common');
  return (
    <div className={`flex flex-col gap-1.5 flex-1 min-w-25 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-medium uppercase tracking-wider text-content-subtle"
      >
        {label}
        {optional && (
          <span className="ml-1 text-content-faint normal-case tracking-normal font-normal">
            {t('optional')}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ─── Switch ───────────────────────────────────────────────────────────────────
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}
export function Switch({ checked, onChange, disabled = false, label, id }: Readonly<SwitchProps>) {
  return (
    <label
      className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <button
        role="switch"
        type="button"
        aria-checked={checked}
        id={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 disabled:cursor-not-allowed ${checked ? 'bg-brand-600' : 'bg-surface-strong'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
      {label !== undefined && <span className="text-sm text-content-secondary">{label}</span>}
    </label>
  );
}
