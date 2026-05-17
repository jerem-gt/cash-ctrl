import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}
export function Card({ children, className = '', size = 'md' }: Readonly<CardProps>) {
  const padding = { sm: 'p-4', md: 'p-5' };
  return (
    <div
      className={`bg-white border border-black/[0.07] rounded-2xl ${padding[size]} shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-4">
      {children}
    </p>
  );
}

// ─── Metric ───────────────────────────────────────────────────────────────────
interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  variant?: 'default' | 'positive' | 'negative';
}
export function Metric({ label, value, sub, variant = 'default' }: Readonly<MetricProps>) {
  const colors = {
    default: 'text-stone-900',
    positive: 'text-green-800',
    negative: 'text-red-800',
  };
  return (
    <Card size="sm">
      <p className="text-[11px] text-stone-400 uppercase tracking-wider mb-1.5">{label}</p>
      <p className={`font-sans text-2xl ${colors[variant]}`}>{value}</p>
      {sub && <p className="text-[11px] text-stone-300 mt-1">{sub}</p>}
    </Card>
  );
}

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }: Readonly<{ className?: string }>) {
  return <div className={`bg-stone-100 animate-pulse rounded-md ${className}`} />;
}

// ─── Empty ────────────────────────────────────────────────────────────────────
export function Empty({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="text-center py-12 text-stone-300 text-sm">{children}</div>;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
const LIMIT_OPTIONS = [10, 25, 50, 100];

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}
export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onChange,
  onLimitChange,
}: Readonly<PaginationProps>) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  function handlePageInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const val = Number.parseInt((e.target as HTMLInputElement).value, 10);
    if (!Number.isNaN(val) && val >= 1 && val <= totalPages) onChange(val);
    (e.target as HTMLInputElement).value = '';
  }

  return (
    <nav className="flex items-center justify-between pt-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-400">
          {from}–{to} sur {total}
        </span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="text-xs text-stone-500 bg-transparent border border-black/10 rounded px-1.5 py-1 outline-none hover:border-black/20 transition-all"
        >
          {LIMIT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o} / page
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-black/10 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Première page"
        >
          «
        </button>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-black/10 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Page précédente"
        >
          ←
        </button>
        <div className="flex items-center gap-1 px-1">
          <input
            type="number"
            min={1}
            max={totalPages}
            placeholder={String(page)}
            onKeyDown={handlePageInput}
            className="w-10 text-center text-xs text-stone-600 bg-white border border-black/10 rounded px-1 py-1 outline-none focus:border-black/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-stone-400">/ {totalPages}</span>
        </div>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-black/10 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Page suivante"
        >
          →
        </button>
        <button
          onClick={() => onChange(totalPages)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-black/10 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Dernière page"
        >
          »
        </button>
      </div>
    </nav>
  );
}

// ─── Toast (global) ───────────────────────────────────────────────────────────
let toastTimer: ReturnType<typeof setTimeout>;
export function showToast(msg: string) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('opacity-100', 'translate-y-0');
  el.classList.remove('opacity-0', 'translate-y-2');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('opacity-100', 'translate-y-0');
    el.classList.add('opacity-0', 'translate-y-2');
  }, 2600);
}

export function Toast() {
  return (
    <div
      id="toast"
      className="fixed bottom-6 right-6 bg-stone-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg opacity-0 translate-y-2 transition-all duration-200 pointer-events-none z-50"
    />
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  title: string;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}
export function ConfirmModal({
  title,
  body,
  onConfirm,
  onCancel,
  isPending,
}: Readonly<ModalProps>) {
  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-xl">
        <h3 className="font-sans text-xl mb-2">{title}</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-6">{body}</p>
        <div className="flex gap-2 justify-end">
          <Button onClick={onCancel} disabled={isPending}>
            Annuler
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isPending}>
            {isPending ? '…' : 'Confirmer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
