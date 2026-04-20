import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps { children: ReactNode; className?: string; }
export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white border border-black/[0.07] rounded-2xl p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-4">{children}</p>;
}

// ─── Metric ───────────────────────────────────────────────────────────────────
interface MetricProps { label: string; value: string; sub?: string; variant?: 'default' | 'positive' | 'negative'; }
export function Metric({ label, value, sub, variant = 'default' }: MetricProps) {
  const colors = { default: 'text-stone-900', positive: 'text-green-800', negative: 'text-red-800' };
  return (
    <div className="bg-white border border-black/[0.07] rounded-2xl p-4 shadow-sm">
      <p className="text-[11px] text-stone-400 uppercase tracking-wider mb-1.5">{label}</p>
      <p className={`font-serif text-2xl ${colors[variant]}`}>{value}</p>
      {sub && <p className="text-[11px] text-stone-300 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'export';
  size?: 'sm' | 'md';
}
export function Button({ variant = 'default', size = 'md', className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  const variants = {
    default: 'bg-white border border-black/[0.13] text-stone-800 hover:bg-stone-50',
    primary: 'bg-stone-900 text-white border border-transparent hover:bg-stone-700',
    danger:  'bg-white border border-red-200 text-red-700 hover:bg-red-50',
    export:  'bg-green-50 border border-transparent text-green-800 hover:bg-green-100',
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-all ${className}`}
      {...props}
    />
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all ${className}`}
      {...props}
    />
  );
}

// ─── FormGroup ────────────────────────────────────────────────────────────────
export function FormGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-25">
      <label className="text-[11px] font-medium uppercase tracking-wider text-stone-400">{label}</label>
      {children}
    </div>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────
export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-center py-12 text-stone-300 text-sm">{children}</div>;
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
}
export function ConfirmModal({ title, body, onConfirm, onCancel }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-xl">
        <h3 className="font-serif text-xl mb-2">{title}</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-6">{body}</p>
        <div className="flex gap-2 justify-end">
          <Button onClick={onCancel}>Annuler</Button>
          <Button variant="primary" onClick={onConfirm}>Confirmer</Button>
        </div>
      </div>
    </div>
  );
}
