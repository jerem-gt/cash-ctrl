import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  variant: 'blue' | 'indigo' | 'green' | 'amber' | 'stone' | 'brand';
  children: ReactNode;
}
export function Badge({ variant, children }: Readonly<BadgeProps>) {
  const variants = {
    blue: 'bg-info-surface text-info border-info/30',
    indigo: 'bg-info-surface text-info border-info/30',
    green: 'bg-success-surface text-success border-success/30',
    amber: 'bg-warning-surface text-warning border-warning/30',
    stone: 'bg-surface-emphasis text-content-muted border-line',
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
  };
  return (
    <span
      className={`text-[10px] border rounded px-1.5 py-0.5 font-medium shrink-0 ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md';
}
export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}: Readonly<ButtonProps>) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  const variants = {
    default: 'bg-surface border border-line text-content hover:bg-surface-muted',
    primary: 'bg-brand-600 text-white border border-transparent hover:bg-brand-700',
    danger: 'bg-surface border border-danger/30 text-danger hover:bg-danger-surface',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'default' | 'danger';
}
export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...props
}: Readonly<IconButtonProps>) {
  const sizes = { sm: 'h-7 w-7', md: 'h-8 w-8' };
  const variants = {
    ghost: 'text-content-subtle hover:text-content-secondary hover:bg-surface-emphasis',
    default: 'bg-surface border border-line text-content-secondary hover:bg-surface-muted',
    danger: 'text-danger hover:text-danger hover:bg-danger-surface',
  };
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({
  className = '',
  ...props
}: Readonly<InputHTMLAttributes<HTMLInputElement>>) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm bg-surface-muted border border-line rounded-lg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}

// ─── DecimalInput ─────────────────────────────────────────────────────────────
function isDecimalInProgress(value: string, allowNegative: boolean): boolean {
  if (value === '') return true;
  if (!allowNegative && value.includes('-')) return false;
  // États intermédiaires valides : ".", "-", "-."
  if (value === '.' || value === '-' || value === '-.') return true;
  const n = Number(value);
  return !Number.isNaN(n) && !value.includes(' ') && !value.toLowerCase().includes('e');
}

interface DecimalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  allowNegative?: boolean;
}

export function DecimalInput({
  allowNegative = false,
  onChange,
  ...props
}: Readonly<DecimalInputProps>) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isDecimalInProgress(e.target.value, allowNegative)) onChange?.(e);
  };
  return <Input type="text" inputMode="decimal" onChange={handleChange} {...props} />;
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({
  className = '',
  ...props
}: Readonly<SelectHTMLAttributes<HTMLSelectElement>>) {
  return (
    <select
      className={`w-full h-9 px-3 py-2 text-sm text-content-secondary bg-surface border border-line rounded-lg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all ${className}`}
      {...props}
    />
  );
}
