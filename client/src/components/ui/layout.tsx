import type { ReactNode } from 'react';

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

// ─── Tabs ─────────────────────────────────────────────────────────────────────
interface TabItem {
  key: string;
  label: string;
}
interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}
export function Tabs({ tabs, active, onChange, className = '' }: Readonly<TabsProps>) {
  return (
    <div className={`flex gap-1 p-1 bg-stone-100 rounded-lg ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all duration-150 font-medium ${
            active === tab.key
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
