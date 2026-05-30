import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { fmt, fmtDec } from '@/lib/format';

export interface IncomeExpenseDatum {
  month: string;
  Revenus: number;
  Depenses: number;
}

interface Props {
  data: IncomeExpenseDatum[];
  incomeLabel: string;
  expenseLabel: string;
}

export default function IncomeExpenseBarChart({
  data,
  incomeLabel,
  expenseLabel,
}: Readonly<Props>) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barGap={4}>
        <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => fmt(Number(v))}
          width={70}
        />
        <Tooltip formatter={(v) => (v == null ? '' : fmtDec(Number(v)))} />
        <Bar dataKey="Revenus" name={incomeLabel} fill="#7DBB4A" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Depenses" name={expenseLabel} fill="#D46060" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
