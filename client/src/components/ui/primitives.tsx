import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  variant: 'blue' | 'indigo' | 'green' | 'amber' | 'stone';
  children: ReactNode;
}
export function Badge({ variant, children }: Readonly<BadgeProps>) {
  const variants = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-500 border-indigo-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    stone: 'bg-stone-100 text-stone-500 border-stone-200',
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
  variant?: 'default' | 'primary' | 'danger' | 'export';
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
    default: 'bg-white border border-black/[0.13] text-stone-800 hover:bg-stone-50',
    primary: 'bg-stone-900 text-white border border-transparent hover:bg-stone-700',
    danger: 'bg-white border border-red-200 text-red-700 hover:bg-red-50',
    export: 'bg-green-50 border border-transparent text-green-800 hover:bg-green-100',
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
    ghost: 'text-stone-400 hover:text-stone-700 hover:bg-stone-100',
    default: 'bg-white border border-black/[0.13] text-stone-700 hover:bg-stone-50',
    danger: 'text-red-400 hover:text-red-700 hover:bg-red-50',
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
      className={`w-full px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
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
      className={`w-full h-9 px-3 py-2 text-sm text-stone-700 bg-white border border-stone-200 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-all ${className}`}
      {...props}
    />
  );
}
