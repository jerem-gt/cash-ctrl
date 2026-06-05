import { useId } from 'react';
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useIsDark } from '@/hooks/useTheme';
import { axisTickProps, chartTheme, tooltipStyleProps } from '@/lib/chartTheme';
import { fmt, fmtDec } from '@/lib/format';

interface Props {
  data: Array<Record<string, string | number>>;
  label: string;
}

export const NET_BALANCE_COLOR = '#139AAE';

export default function NetBalanceLineChart({ data, label }: Readonly<Props>) {
  const theme = chartTheme(useIsDark());
  const axisTick = axisTickProps(theme);
  const hasNegative = data.some((d) => Number(d._total) < 0);
  const elementId = useId();
  const gradId = `nbg${elementId.replace(/:/g, '')}`;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={NET_BALANCE_COLOR} stopOpacity={0.22} />
            <stop offset="95%" stopColor={NET_BALANCE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="year" {...axisTick} />
        <YAxis {...axisTick} tickFormatter={(v) => fmt(Number(v))} width={70} />
        <Tooltip
          formatter={(v) => [fmtDec(Number(v)), label]}
          {...tooltipStyleProps(theme)}
          cursor={{ stroke: theme.refLine, strokeWidth: 1 }}
        />
        {hasNegative && <ReferenceLine y={0} stroke={theme.refLine} strokeWidth={1} />}
        <Area
          type="monotone"
          dataKey="_total"
          name={label}
          stroke={NET_BALANCE_COLOR}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={{ r: 3, fill: NET_BALANCE_COLOR, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: NET_BALANCE_COLOR, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
