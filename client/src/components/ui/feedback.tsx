import type { ReactNode } from 'react';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }: Readonly<{ className?: string }>) {
  return <div className={`bg-stone-100 animate-pulse rounded-md ${className}`} />;
}

// ─── Empty ────────────────────────────────────────────────────────────────────
export function Empty({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="text-center py-12 text-stone-300 text-sm">{children}</div>;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className = '' }: Readonly<{ className?: string }>) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z"
      />
    </svg>
  );
}

// ─── Alert ────────────────────────────────────────────────────────────────────
interface AlertProps {
  variant: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
}
export function Alert({ variant, children }: Readonly<AlertProps>) {
  const variants = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };
  return (
    <div className={`text-sm px-4 py-3 rounded-lg border ${variants[variant]}`}>{children}</div>
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
