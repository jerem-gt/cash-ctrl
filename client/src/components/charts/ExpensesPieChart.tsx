import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { fmtDec } from '@/lib/format';

export interface ExpensesPieDatum {
  name: string;
  value: number;
  fill: string | undefined;
}

export default function ExpensesPieChart({ data }: Readonly<{ data: ExpensesPieDatum[] }>) {
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
        <Tooltip formatter={(v) => (v == null ? '' : fmtDec(Number(v)))} />
      </PieChart>
    </ResponsiveContainer>
  );
}
