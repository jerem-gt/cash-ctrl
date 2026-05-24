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
  variant?: 'default' | 'dark';
}

const TAB_STYLES = {
  default: {
    container: 'bg-stone-100 rounded-lg p-1',
    button: 'px-3 py-1.5 text-sm rounded-md',
    active: 'bg-white text-stone-900 shadow-sm',
    inactive: 'text-stone-500 hover:text-stone-700',
  },
  dark: {
    container: 'bg-white/6 rounded-md p-0.5',
    button: 'px-1.5 py-1 text-xs rounded',
    active: 'bg-white/15 text-white/80 shadow-sm',
    inactive: 'text-white/30 hover:text-white/55',
  },
};

export function Tabs({
  tabs,
  active,
  onChange,
  className = '',
  variant = 'default',
}: Readonly<TabsProps>) {
  const s = TAB_STYLES[variant];
  return (
    <div className={`flex gap-1 ${s.container} ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 ${s.button} transition-all duration-150 font-medium ${
            active === tab.key ? s.active : s.inactive
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
