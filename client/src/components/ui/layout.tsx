import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
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
      className={`bg-surface border border-line-subtle rounded-2xl ${padding[size]} shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-widest text-content-subtle mb-4">
      {children}
    </p>
  );
}

// ─── Metric ───────────────────────────────────────────────────────────────────
export interface MetricTrend {
  direction: 'up' | 'down' | 'flat'; // sens de la variation (flèche)
  value: string; // magnitude déjà formatée (ex. « 12 % », « 150 € »)
  positive: boolean; // true = variation favorable (vert), false = défavorable (rouge)
}
interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  variant?: 'default' | 'positive' | 'negative';
  icon?: ReactNode;
  trend?: MetricTrend;
  trendLabel?: string;
}

const METRIC_VALUE_COLORS = {
  default: 'text-content',
  positive: 'text-success',
  negative: 'text-danger',
};
const METRIC_ICON_COLORS = {
  default: 'bg-brand-50 text-brand-600',
  positive: 'bg-success-surface text-success',
  negative: 'bg-danger-surface text-danger',
};

function MetricTrendBadge({
  trend,
  trendLabel,
}: Readonly<{ trend: MetricTrend; trendLabel?: string }>) {
  // Couleur = favorable/défavorable ; flèche = sens réel de la variation.
  let tone: string;
  let Arrow: typeof Minus;
  if (trend.direction === 'flat') {
    tone = 'text-content-subtle';
    Arrow = Minus;
  } else {
    tone = trend.positive ? 'text-success' : 'text-danger';
    Arrow = trend.direction === 'up' ? ArrowUpRight : ArrowDownRight;
  }
  return (
    <p className="flex items-center gap-1 mt-1 text-[11px]">
      <span className={`inline-flex items-center gap-0.5 font-medium ${tone}`}>
        <Arrow size={12} strokeWidth={2.5} />
        {trend.value}
      </span>
      {trendLabel && <span className="text-content-faint">{trendLabel}</span>}
    </p>
  );
}

export function Metric({
  label,
  value,
  sub,
  variant = 'default',
  icon,
  trend,
  trendLabel,
}: Readonly<MetricProps>) {
  let footer: ReactNode = null;
  if (trend) {
    footer = <MetricTrendBadge trend={trend} trendLabel={trendLabel} />;
  } else if (sub) {
    footer = <p className="text-[11px] text-content-faint mt-1">{sub}</p>;
  }
  return (
    <Card size="sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-content-subtle uppercase tracking-wider mb-1.5">{label}</p>
        {icon && (
          <span
            className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-lg ${METRIC_ICON_COLORS[variant]}`}
          >
            {icon}
          </span>
        )}
      </div>
      <p className={`font-display text-2xl tabular-nums ${METRIC_VALUE_COLORS[variant]}`}>
        {value}
      </p>
      {footer}
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
  variant?: 'default' | 'sidebar';
}

const TAB_STYLES = {
  default: {
    container: 'bg-surface-emphasis rounded-lg p-1',
    button: 'px-3 py-1.5 text-sm rounded-md',
    active: 'bg-surface text-content shadow-sm',
    inactive: 'text-content-muted hover:text-content-secondary',
  },
  sidebar: {
    container: 'bg-white/6 rounded-md p-0.5',
    button: 'px-1.5 py-1 text-xs rounded',
    active: 'bg-brand-600 text-white shadow-sm',
    inactive: 'text-white/40 hover:text-white/70',
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
