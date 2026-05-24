import type { ReactNode } from 'react';

// ─── FormGroup ────────────────────────────────────────────────────────────────
export function FormGroup({
  label,
  htmlFor,
  className = '',
  children,
}: Readonly<{ label: string; htmlFor?: string; className?: string; children: ReactNode }>) {
  return (
    <div className={`flex flex-col gap-1.5 flex-1 min-w-25 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-medium uppercase tracking-wider text-stone-400"
      >
        {label}
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
        aria-checked={checked}
        id={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:ring-offset-1 disabled:cursor-not-allowed ${checked ? 'bg-green-600' : 'bg-stone-200'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
      {label !== undefined && <span className="text-sm text-stone-700">{label}</span>}
    </label>
  );
}
