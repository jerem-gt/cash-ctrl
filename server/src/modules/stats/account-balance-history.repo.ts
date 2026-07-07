import type { AccountBalanceHistoryResponse, BalanceHistoryPoint } from '@cashctrl/types';
import type { Database } from 'better-sqlite3';

import { dateStr, parseDate } from '../../lib/dateUtils';
import { VALIDATED_TX_SUM_SELECT } from '../../lib/sql';

interface CurrentBalanceRow {
  balance: number;
}

interface DailyDeltaRow {
  date: string;
  delta: number;
}

export function createAccountBalanceHistoryRepo(db: Database) {
  const currentBalanceStmt = db.prepare<{ accountId: number }, CurrentBalanceRow>(`
    SELECT a.initial_balance + COALESCE(bal.s, 0) AS balance
    FROM accounts a
    LEFT JOIN (
      ${VALIDATED_TX_SUM_SELECT} AND account_id = :accountId GROUP BY account_id
    ) bal ON bal.account_id = a.id
    WHERE a.id = :accountId
  `);

  const dailyDeltasStmt = db.prepare<
    { accountId: number; from: string; to: string },
    DailyDeltaRow
  >(`
    SELECT date, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS delta
    FROM transactions
    WHERE account_id = :accountId AND validated = 1 AND date > :from AND date <= :to
    GROUP BY date
  `);

  return {
    // Reconstruit le solde jour par jour en remontant depuis le solde actuel (cf. forecast.repo.ts).
    getBalanceHistory(
      accountId: number,
      days: number,
      today: string,
    ): AccountBalanceHistoryResponse {
      const todayDate = parseDate(today);
      const oldestDate = new Date(todayDate);
      oldestDate.setDate(oldestDate.getDate() - (days - 1));
      const oldestStr = dateStr(oldestDate);

      const currentBalance = currentBalanceStmt.get({ accountId })?.balance ?? 0;
      const deltaRows = dailyDeltasStmt.all({ accountId, from: oldestStr, to: today });
      const deltaByDate = new Map(deltaRows.map((r) => [r.date, r.delta]));

      let balanceAtOldest = currentBalance;
      for (const r of deltaRows) balanceAtOldest -= r.delta;

      const points: BalanceHistoryPoint[] = [];
      let running = balanceAtOldest;
      for (let i = 0; i < days; i++) {
        const d = new Date(oldestDate);
        d.setDate(d.getDate() + i);
        const dStr = dateStr(d);
        if (i > 0) running += deltaByDate.get(dStr) ?? 0;
        points.push({ date: dStr, balance: running });
      }

      return { account_id: accountId, days, points };
    },
  };
}
