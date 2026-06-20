import type { Database } from 'better-sqlite3';

import { toEuros } from '../../lib/money';
import type { AccountProfitability } from './profitability.types';
import {
  buildFlowsByAccountYear,
  buildYearlyReturn,
  type DatedFlow,
  getAllYears,
  groupByAccount,
  twrAnnualized,
} from './stats.calculations';

export function computeSavingsProfitability(
  db: Database,
  userId: number,
  currentYear: number,
  todayStr: string,
  financialIncomeCategoryId: number,
): AccountProfitability[] {
  type SavRow = {
    account_id: number;
    account_name: string;
    envelope_type: string | null;
    account_type: string;
    opening_date: string;
    initial_balance: number;
    deposits_cents: number;
    withdrawals_cents: number;
    balance_cents: number;
  };
  type SavYearRow = {
    account_id: number;
    year: string;
    deposits_cents: number;
    withdrawals_cents: number;
    delta_cents: number;
  };

  const savAccounts = db
    .prepare<{ userId: number; finCatId: number }, SavRow>(
      `SELECT
         a.id AS account_id, a.name AS account_name,
         at.envelope_type, at.name AS account_type,
         COALESCE(a.opening_date, MIN(t.date)) AS opening_date, a.initial_balance,
         COALESCE(SUM(CASE WHEN t.type='income' AND (c.id IS NULL OR c.id != :finCatId) AND t.validated=1 THEN t.amount ELSE 0 END),0) AS deposits_cents,
         COALESCE(SUM(CASE WHEN t.type='expense' AND t.transfer_peer_id IS NOT NULL AND t.validated=1 THEN t.amount ELSE 0 END),0) AS withdrawals_cents,
         a.initial_balance + COALESCE(SUM(CASE WHEN t.validated=1 THEN CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END ELSE 0 END),0) AS balance_cents
       FROM accounts a
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN transactions t ON t.account_id = a.id
       LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
       LEFT JOIN categories c ON sc.category_id = c.id
       WHERE a.user_id = :userId AND at.envelope_type = 'savings' AND a.closed_at IS NULL
       GROUP BY a.id, a.name, at.envelope_type, at.name, a.initial_balance`,
    )
    .all({ userId, finCatId: financialIncomeCategoryId });

  const savYearlyByAccount = groupByAccount(
    db
      .prepare<{ userId: number; finCatId: number }, SavYearRow>(
        `SELECT
         t.account_id,
         strftime('%Y', t.date) AS year,
         COALESCE(SUM(CASE WHEN t.type='income' AND (c.id IS NULL OR c.id != :finCatId) AND t.validated=1 THEN t.amount ELSE 0 END),0) AS deposits_cents,
         COALESCE(SUM(CASE WHEN t.type='expense' AND t.transfer_peer_id IS NOT NULL AND t.validated=1 THEN t.amount ELSE 0 END),0) AS withdrawals_cents,
         COALESCE(SUM(CASE WHEN t.validated=1 THEN CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END ELSE 0 END),0) AS delta_cents
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
       LEFT JOIN categories c ON sc.category_id = c.id
       WHERE a.user_id = :userId AND at.envelope_type = 'savings' AND a.closed_at IS NULL
       GROUP BY t.account_id, year
       ORDER BY t.account_id, year`,
      )
      .all({ userId, finCatId: financialIncomeCategoryId }),
  );

  const savFlowsByAccountYear = buildFlowsByAccountYear(
    db
      .prepare<
        { userId: number; finCatId: number },
        { account_id: number; date: string; signed_cents: number }
      >(
        `SELECT t.account_id, t.date,
         CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END AS signed_cents
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
       LEFT JOIN categories c ON sc.category_id = c.id
       WHERE a.user_id = :userId AND at.envelope_type = 'savings' AND a.closed_at IS NULL
         AND t.validated = 1
         AND (
           (t.type = 'income' AND (c.id IS NULL OR c.id != :finCatId))
           OR (t.type = 'expense' AND t.transfer_peer_id IS NOT NULL)
         )
       ORDER BY t.account_id, t.date`,
      )
      .all({ userId, finCatId: financialIncomeCategoryId }),
  );

  return savAccounts
    .filter((acc) => acc.opening_date != null)
    .map((acc) => {
      const capitalInvesti = toEuros(
        acc.initial_balance + acc.deposits_cents - acc.withdrawals_cents,
      );
      const valeurActuelle = toEuros(acc.balance_cents);
      const plusValue = valeurActuelle - capitalInvesti;
      const rendementTotalPct = capitalInvesti > 0 ? (plusValue / capitalInvesti) * 100 : 0;

      const years = getAllYears(acc.opening_date, currentYear);
      const yearlyRowMap = new Map(
        (savYearlyByAccount.get(acc.account_id) ?? []).map((r) => [r.year, r]),
      );
      const yearly_returns = [];
      let runningBalance = 0;

      for (const year of years) {
        const isCurrentYear = Number.parseInt(year, 10) === currentYear;
        const isFirstYear = year === years[0];
        const row = yearlyRowMap.get(year);

        const start_value = runningBalance;
        const yearCashFlows = savFlowsByAccountYear.get(acc.account_id)?.get(year) ?? [];
        const yearFlows: DatedFlow[] =
          isFirstYear && acc.initial_balance !== 0
            ? [{ date: acc.opening_date, signed_cents: acc.initial_balance }, ...yearCashFlows]
            : yearCashFlows;
        const netFlows = yearFlows.reduce((s, f) => s + toEuros(f.signed_cents), 0);
        const economicEnd =
          runningBalance +
          (isFirstYear ? toEuros(acc.initial_balance) : 0) +
          (row ? toEuros(row.delta_cents) : 0);
        const end_value = isCurrentYear ? valeurActuelle : economicEnd;
        yearly_returns.push(
          buildYearlyReturn(
            year,
            start_value,
            end_value,
            netFlows,
            yearFlows,
            isCurrentYear,
            todayStr,
          ),
        );

        runningBalance = economicEnd;
      }

      return {
        account_id: acc.account_id,
        account_name: acc.account_name,
        envelope_type: acc.envelope_type,
        account_type: acc.account_type,
        opening_date: acc.opening_date,
        capital_investi: capitalInvesti,
        capital_retire: toEuros(acc.withdrawals_cents),
        valeur_actuelle: valeurActuelle,
        plus_value_absolue: plusValue,
        rendement_total_pct: rendementTotalPct,
        rendement_annualise_pct: twrAnnualized(yearly_returns, acc.opening_date, true),
        yearly_returns,
      };
    });
}
