import { useId } from 'react';
import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useIsDark } from '@/hooks/useTheme';
import { axisTickProps, chartTheme, tooltipStyleProps } from '@/lib/chartTheme';
import { fmtCurrency, fmtDateShort } from '@/lib/format';

interface ForecastChartPoint {
  date: string;
  balance: number;
}

interface Props {
  points: ForecastChartPoint[];
  goesNegativeOn: string | null;
  label: string;
}

const BRAND_COLOR = '#139AAE';

export default function ForecastAreaChart({ points, goesNegativeOn, label }: Readonly<Props>) {
  const isDark = useIsDark();
  const theme = chartTheme(isDark);
  const axisTick = axisTickProps(theme);
  const dangerColor = isDark ? '#f87171' : '#b91c1c';
  const hasNegative = points.some((p) => p.balance < 0);
  const color = hasNegative ? dangerColor : BRAND_COLOR;
  const elementId = useId();
  const gradId = `fcg${elementId.replaceAll(':', '')}`;
  // Un tick sur ~6, sans jamais tomber à 0 (recharts interprète 0 comme "tout afficher").
  const tickInterval = Math.max(1, Math.ceil(points.length / 6) - 1);
  const negativePoint = goesNegativeOn ? points.find((p) => p.date === goesNegativeOn) : undefined;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.22} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          interval={tickInterval}
          tickFormatter={(v: string) => fmtDateShort(v)}
          {...axisTick}
        />
        <YAxis {...axisTick} tickFormatter={(v) => fmtCurrency(Number(v))} width={80} />
        <Tooltip
          labelFormatter={(v) => fmtDateShort(String(v))}
          formatter={(v) => [fmtCurrency(Number(v)), label]}
          {...tooltipStyleProps(theme)}
          cursor={{ stroke: theme.refLine, strokeWidth: 1 }}
        />
        <ReferenceLine y={0} stroke={theme.refLine} strokeWidth={1} />
        <Area
          type="monotone"
          dataKey="balance"
          name={label}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
        />
        {negativePoint && (
          <ReferenceDot
            x={negativePoint.date}
            y={negativePoint.balance}
            r={5}
            fill={dangerColor}
            stroke="none"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
