import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie,
} from 'recharts';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useBanks } from '@/hooks/useBanks';
import { Card, CardTitle, Metric, Empty } from '@/components/ui';
import { TxItem } from '@/components/TxItem';
import { fmt, fmtDec, today, isThisMonth, monthLabel, isSameMonth } from '@/lib/format';
import { computeBalance } from '@/lib/account';

export function DashboardPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map(b => [b.name, b.logo])), [banks]);

  const colorMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.name, c.color])),
    [categories]
  );

  const nonTransfers = transactions.filter(t => t.transfer_peer_id === null);

  const totalBalance = accounts.reduce((s, a) => s + computeBalance(a, transactions), 0);
  const monthIncome  = nonTransfers.filter(t => t.type === 'income'  && isThisMonth(t.date)).reduce((s, t) => s + t.amount, 0);
  const monthExpense = nonTransfers.filter(t => t.type === 'expense' && isThisMonth(t.date)).reduce((s, t) => s + t.amount, 0);
  const bilan = monthIncome - monthExpense;

  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    nonTransfers.filter(t => t.type === 'expense' && isThisMonth(t.date))
      .forEach(t => { map[t.category] = (map[t.category] ?? 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value, fill: colorMap[name] ?? '#9E9A92' }));
  }, [nonTransfers, colorMap]);

  const barData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i;
      return {
        month: monthLabel(offset),
        Revenus:  nonTransfers.filter(t => t.type === 'income'  && isSameMonth(t.date, offset)).reduce((s, t) => s + t.amount, 0),
        Depenses: nonTransfers.filter(t => t.type === 'expense' && isSameMonth(t.date, offset)).reduce((s, t) => s + t.amount, 0),
      };
    }), [nonTransfers]);

  const todayStr = today();

  const recent = useMemo(
    () => transactions
      .filter(t => !!t.validated)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6),
    [transactions]
  );

  const toValidate = useMemo(
    () => transactions
      .filter(t => !t.validated && t.date <= todayStr)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
    [transactions, todayStr]
  );

  const upcoming = useMemo(
    () => transactions
      .filter(t => t.scheduled_id !== null && t.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5),
    [transactions, todayStr]
  );

  const txItemProps = { accounts, logoMap };

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
                  <Tooltip formatter={(v) => v == null ? '' : fmtDec(Number(v))} />
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
              <Tooltip formatter={(v) => v == null ? '' : fmtDec(Number(v))} />
              <Bar dataKey="Revenus"  name="Revenus"  fill="#7DBB4A" radius={[3,3,0,0]} />
              <Bar dataKey="Depenses" name="Dépenses" fill="#D46060" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Transactions — À valider + À venir */}
      {(toValidate.length > 0 || upcoming.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {toValidate.length > 0 && (
            <Card>
              <CardTitle>À valider</CardTitle>
              <div className="flex flex-col gap-2 mt-1">
                {toValidate.map(t => (
                  <TxItem key={t.id} tx={t} {...txItemProps} />
                ))}
              </div>
            </Card>
          )}
          {upcoming.length > 0 && (
            <Card>
              <CardTitle>À venir</CardTitle>
              <div className="flex flex-col gap-2 mt-1">
                {upcoming.map(t => (
                  <TxItem key={t.id} tx={t} {...txItemProps} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Dernières transactions */}
      <Card>
        <CardTitle>Dernières transactions validées</CardTitle>
        {recent.length === 0 ? (
          <Empty>Aucune transaction</Empty>
        ) : (
          <div className="flex flex-col gap-2 mt-1">
            {recent.map(t => (
              <TxItem key={t.id} tx={t} {...txItemProps} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
