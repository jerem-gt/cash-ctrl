import {
  Bar,
  BarChart,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useIsDark } from '@/hooks/useTheme';
import { axisTickProps, chartTheme, tooltipStyleProps } from '@/lib/chartTheme';
import { generateColor } from '@/lib/colors.ts';
import { fmt, fmtDec } from '@/lib/format';

interface Props {
  data: Array<Record<string, string | number>>;
  types: string[];
  negativeTypes: Set<string>;
  lastPositiveType: string | undefined;
  hasLoans: boolean;
  labelFor: (type: string) => string;
}

export default function PatrimonyBarChart({
  data,
  types,
  negativeTypes,
  lastPositiveType,
  hasLoans,
  labelFor,
}: Readonly<Props>) {
  const theme = chartTheme(useIsDark());
  const axisTick = axisTickProps(theme);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        stackOffset="sign"
        barGap={2}
        margin={{ top: 18, right: 8, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="year" {...axisTick} />
        <YAxis {...axisTick} tickFormatter={(v) => fmt(Number(v))} width={70} />
        <Tooltip
          formatter={(v, name, entry) => {
            if (name === '_total') return null;
            const total = (entry.payload as Record<string, number>)._total;
            const pct = total === 0 ? 0 : (Number(v) / total) * 100;
            return [`${fmtDec(Number(v))} (${pct.toFixed(1)} %)`, labelFor(String(name))];
          }}
          {...tooltipStyleProps(theme)}
          cursor={{ fill: theme.cursor }}
        />
        {hasLoans && <ReferenceLine y={0} stroke={theme.refLine} strokeWidth={1} />}
        {types.map((type, i) => {
          const isNeg = negativeTypes.has(type);
          const isTopPositive = type === lastPositiveType;
          const radius = isNeg || isTopPositive ? [3, 3, 0, 0] : [0, 0, 0, 0];
          return (
            <Bar
              key={type}
              dataKey={type}
              stackId="a"
              fill={generateColor(i)}
              radius={radius as [number, number, number, number]}
            >
              {isTopPositive && (
                <LabelList
                  dataKey="_total"
                  position="top"
                  formatter={(v: unknown) => fmt(Number(v ?? 0))}
                  style={{ fontSize: 10, fill: theme.axisTick }}
                />
              )}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
