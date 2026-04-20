import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie,
} from 'recharts';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { Card, CardTitle, Metric, Empty } from '@/components/ui';
import { fmt, fmtDec, fmtDateShort, isThisMonth, monthLabel, isSameMonth } from '@/lib/format';
import type { Account, Transaction } from '@/types';

function computeBalance(account: Account, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.account_id === account.id)
    .reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, account.initial_balance);
}

function TxRow({ tx }: { tx: Transaction }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/4 last:border-0">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-green-500' : 'bg-red-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        <p className="text-[11px] text-stone-400">{tx.category} · {tx.account_name} · {fmtDateShort(tx.date)}</p>
      </div>
      <span className={`text-sm font-medium tabular-nums ${tx.type === 'income' ? 'text-green-800' : 'text-red-700'}`}>
        {tx.type === 'income' ? '+' : '−'}{fmtDec(tx.amount)}
      </span>
    </div>
  );
}

export function DashboardPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();

  const colorMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.name, c.color])),
    [categories]
  );

  const nonTransfers = transactions.filter(t => t.transfer_peer_id === null);

  const totalBalance = accounts.reduce((s, a) => s + computeBalance(a, transactions), 0);
  const monthIncome  = nonTransfers.filter(t => t.type === 'income'  && isThisMonth(t.date)).reduce((s, t) => s + t.amount, 0);
  const monthExpense = nonTransfers.filter(t => t.type === 'expense' && isThisMonth(t.date)).reduce((s, t) => s + t.amount, 0);
  const bilan = monthIncome - monthExpense;

  // Donut data
  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    nonTransfers.filter(t => t.type === 'expense' && isThisMonth(t.date))
      .forEach(t => { map[t.category] = (map[t.category] ?? 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value, fill: colorMap[name] ?? '#9E9A92' }));
  }, [nonTransfers, colorMap]);

  // Bar chart data (6 months)
  const barData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i;
      return {
        month: monthLabel(offset),
        Revenus:  nonTransfers.filter(t => t.type === 'income'  && isSameMonth(t.date, offset)).reduce((s, t) => s + t.amount, 0),
        Depenses: nonTransfers.filter(t => t.type === 'expense' && isSameMonth(t.date, offset)).reduce((s, t) => s + t.amount, 0),
      };
    }), [nonTransfers]);

  const recent = [...transactions].slice(0, 6);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Tableau de bord</h2>
        <p className="text-sm text-stone-400 mt-0.5">Vue d'ensemble de vos finances</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Solde total" value={fmt(totalBalance)} sub={`${accounts.length} compte(s)`} />
        <Metric label="Revenus ce mois" value={fmt(monthIncome)} variant="positive" />
        <Metric label="Dépenses ce mois" value={fmt(monthExpense)} variant="negative" />
        <Metric label="Bilan mensuel" value={fmt(bilan)} variant={bilan >= 0 ? 'positive' : 'negative'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Card className="lg:col-span-2">
          <CardTitle>Dépenses par catégorie</CardTitle>
          {catData.length === 0 ? (
            <Empty>Aucune dépense ce mois</Empty>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={catData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} />
                  <Tooltip formatter={(v) => v != null ? fmtDec(Number(v)) : ''} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                {catData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[11px] text-stone-500">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: colorMap[d.name] ?? '#9E9A92' }} />
                    {d.name} <strong className="text-stone-700">{fmt(d.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardTitle>Revenus vs dépenses — 6 mois</CardTitle>
          <div className="flex gap-4 mb-3">
            {[['#7DBB4A', 'Revenus'], ['#D46060', 'Dépenses']].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-stone-400">
                <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barGap={4}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={70} />
              <Tooltip formatter={(v) => v != null ? fmtDec(Number(v)) : ''} />
              <Bar dataKey="Revenus"  name="Revenus"  fill="#7DBB4A" radius={[3,3,0,0]} />
              <Bar dataKey="Depenses" name="Dépenses" fill="#D46060" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent */}
      <Card>
        <CardTitle>Dernières transactions</CardTitle>
        {recent.length === 0
          ? <Empty>Aucune transaction</Empty>
          : recent.map(t => <TxRow key={t.id} tx={t} />)
        }
      </Card>
    </div>
  );
}
