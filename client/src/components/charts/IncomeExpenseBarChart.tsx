import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useIsDark } from '@/hooks/useTheme';
import { axisTickProps, chartTheme, tooltipStyleProps } from '@/lib/chartTheme';
import { fmt, fmtDec } from '@/lib/format';

export const INCOME_COLOR = '#7DBB4A';
export const EXPENSE_COLOR = '#D46060';

export interface IncomeExpenseDatum {
  month: string;
  Revenus: number;
  Depenses: number;
}

interface Props {
  data: IncomeExpenseDatum[];
  compareData?: IncomeExpenseDatum[];
  compareLabel?: string;
  incomeLabel: string;
  expenseLabel: string;
  incomeColor?: string;
  expenseColor?: string;
}

export default function IncomeExpenseBarChart({
  data,
  compareData,
  compareLabel,
  incomeLabel,
  expenseLabel,
  incomeColor = INCOME_COLOR,
  expenseColor = EXPENSE_COLOR,
}: Readonly<Props>) {
  const theme = chartTheme(useIsDark());
  const axisTick = axisTickProps(theme);

  const chartData = compareData
    ? data.map((d, i) => ({
        ...d,
        RevenusComp: compareData[i]?.Revenus ?? 0,
        DepensesComp: compareData[i]?.Depenses ?? 0,
      }))
    : data;

  const suffix = compareLabel ? ` (${compareLabel})` : '';

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={chartData} barGap={4}>
        <XAxis dataKey="month" {...axisTick} />
        <YAxis {...axisTick} tickFormatter={(v) => fmt(Number(v))} width={70} />
        <Tooltip
          formatter={(v) => (v == null ? '' : fmtDec(Number(v)))}
          {...tooltipStyleProps(theme)}
          cursor={{ fill: theme.cursor }}
        />
        <Bar dataKey="Revenus" name={incomeLabel} fill={incomeColor} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Depenses" name={expenseLabel} fill={expenseColor} radius={[3, 3, 0, 0]} />
        {compareData && (
          <>
            <Line
              dataKey="RevenusComp"
              name={`${incomeLabel}${suffix}`}
              stroke={incomeColor}
              strokeDasharray="5 3"
              strokeOpacity={0.6}
              dot={false}
              type="monotone"
            />
            <Line
              dataKey="DepensesComp"
              name={`${expenseLabel}${suffix}`}
              stroke={expenseColor}
              strokeDasharray="5 3"
              strokeOpacity={0.6}
              dot={false}
              type="monotone"
            />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
