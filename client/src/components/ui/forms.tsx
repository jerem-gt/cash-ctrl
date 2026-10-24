import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DateInput } from './primitives';

// ─── FormGroup ────────────────────────────────────────────────────────────────
export function FormGroup({
  label,
  htmlFor,
  className = '',
  minWidthClass = 'min-w-25',
  optional = false,
  children,
}: Readonly<{
  label: string;
  htmlFor?: string;
  className?: string;
  minWidthClass?: string;
  optional?: boolean;
  children: ReactNode;
}>) {
  const { t } = useTranslation('common');
  return (
    <div className={`flex flex-col gap-1.5 flex-1 ${minWidthClass} ${className}`}>
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

// ─── DateField ────────────────────────────────────────────────────────────────
export function DateField({
  id,
  value,
  onChange,
  label,
  required,
  error,
  disabled,
}: Readonly<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  disabled?: boolean;
}>) {
  const { t } = useTranslation('common');
  // min-w-56 : deux boutons de 40 px + la date JJ/MM/AAAA et l'icône calendrier
  return (
    <FormGroup label={label ?? t('date')} htmlFor={id} minWidthClass="min-w-56">
      <DateInput
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        error={error}
        disabled={disabled}
      />
    </FormGroup>
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
