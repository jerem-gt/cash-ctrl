import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { useIsDark } from '@/hooks/useTheme';
import { chartTheme } from '@/lib/chartTheme';
import { fmtDec } from '@/lib/format';

export interface ExpensesPieDatum {
  name: string;
  value: number;
  fill: string | undefined;
}

export default function ExpensesPieChart({ data }: Readonly<{ data: ExpensesPieDatum[] }>) {
  const theme = chartTheme(useIsDark());
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        />
        <Tooltip
          formatter={(v) => (v == null ? '' : fmtDec(Number(v)))}
          contentStyle={theme.tooltipContentStyle}
          itemStyle={theme.tooltipItemStyle}
          labelStyle={theme.tooltipLabelStyle}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
