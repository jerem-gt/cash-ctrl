import type { Database } from 'better-sqlite3';

import { toEuros } from '../../lib/money';
import type { AccountProfitability } from './profitability.types';
import {
  buildFlowsByAccountYear,
  buildYearlyReturn,
  getAllYears,
  groupByAccount,
  twrAnnualized,
} from './stats.calculations';

export function computeInsuranceProfitability(
  db: Database,
  userId: number,
  currentYear: number,
  todayStr: string,
): AccountProfitability[] {
  type InsRow = {
    account_id: number;
    account_name: string;
    envelope_type: string;
    account_type: string;
    opening_date: string;
    versements_cents: number;
    rachats_cents: number;
    balance_eur: number;
  };
  type InsYearRow = {
    account_id: number;
    year: string;
    versements_cents: number;
    rachats_cents: number;
    delta_cents: number;
  };

  const insAccounts = db
    .prepare<[number], InsRow>(
      `SELECT
         a.id AS account_id, a.name AS account_name,
         at.envelope_type, at.name AS account_type,
         COALESCE(a.opening_date, MIN(io.date)) AS opening_date,
         COALESCE(SUM(CASE WHEN io.type='versement' THEN io.amount ELSE 0 END),0) AS versements_cents,
         COALESCE(SUM(CASE WHEN io.type='rachat' THEN io.amount ELSE 0 END),0) AS rachats_cents,
         COALESCE(SUM(
           (CASE WHEN io.type IN ('versement','arbitrage_in','interets','revalorisation')
                 THEN io.amount ELSE -io.amount END) - io.fees - io.social_fees
         ),0) * 1.0 / 100 AS balance_eur
       FROM accounts a
       JOIN account_types at ON a.account_type_id = at.id
       LEFT JOIN insurance_operations io ON io.account_id = a.id
       WHERE a.user_id = ? AND at.envelope_type IN ('life_insurance','per') AND a.closed_at IS NULL
       GROUP BY a.id, a.name, at.envelope_type, at.name`,
    )
    .all(userId);

  const insYearlyByAccount = groupByAccount(
    db
      .prepare<[number], InsYearRow>(
        `SELECT
         io.account_id,
         strftime('%Y', io.date) AS year,
         COALESCE(SUM(CASE WHEN io.type='versement' THEN io.amount ELSE 0 END),0) AS versements_cents,
         COALESCE(SUM(CASE WHEN io.type='rachat' THEN io.amount ELSE 0 END),0) AS rachats_cents,
         COALESCE(SUM(
           (CASE WHEN io.type IN ('versement','arbitrage_in','interets','revalorisation')
                 THEN io.amount ELSE -io.amount END) - io.fees - io.social_fees
         ),0) AS delta_cents
       FROM insurance_operations io
       JOIN accounts a ON a.id = io.account_id
       WHERE a.user_id = ? AND a.closed_at IS NULL
       GROUP BY io.account_id, year
       ORDER BY io.account_id, year`,
      )
      .all(userId),
  );

  const insFlowsByAccountYear = buildFlowsByAccountYear(
    db
      .prepare<[number], { account_id: number; date: string; signed_cents: number }>(
        `SELECT io.account_id, io.date,
         CASE WHEN io.type='versement' THEN io.amount ELSE -io.amount END AS signed_cents
       FROM insurance_operations io
       JOIN accounts a ON a.id = io.account_id
       WHERE a.user_id = ? AND a.closed_at IS NULL
         AND io.type IN ('versement','rachat')
       ORDER BY io.account_id, io.date`,
      )
      .all(userId),
  );

  return insAccounts
    .filter((acc) => acc.opening_date != null)
    .map((acc) => {
      const capitalInvesti = toEuros(acc.versements_cents);
      const capitalRetire = toEuros(acc.rachats_cents);
      const valeurActuelle = acc.balance_eur;
      const plusValue = valeurActuelle + capitalRetire - capitalInvesti;
      const rendementTotalPct = capitalInvesti > 0 ? (plusValue / capitalInvesti) * 100 : 0;

      const years = getAllYears(acc.opening_date, currentYear);
      const yearlyRowMap = new Map(
        (insYearlyByAccount.get(acc.account_id) ?? []).map((r) => [r.year, r]),
      );
      const yearly_returns = [];
      let runningBalance = 0;

      for (const year of years) {
        const isCurrentYear = Number.parseInt(year, 10) === currentYear;
        const row = yearlyRowMap.get(year);

        const start_value = runningBalance;
        const netFlows = row ? toEuros(row.versements_cents - row.rachats_cents) : 0;
        const delta = row ? toEuros(row.delta_cents) : 0;
        const end_value = isCurrentYear ? valeurActuelle : runningBalance + delta;
        const yearFlows = insFlowsByAccountYear.get(acc.account_id)?.get(year) ?? [];
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

        runningBalance = end_value;
      }

      return {
        account_id: acc.account_id,
        account_name: acc.account_name,
        envelope_type: acc.envelope_type,
        account_type: acc.account_type,
        opening_date: acc.opening_date,
        capital_investi: capitalInvesti,
        capital_retire: capitalRetire,
        valeur_actuelle: valeurActuelle,
        plus_value_absolue: plusValue,
        rendement_total_pct: rendementTotalPct,
        rendement_annualise_pct: twrAnnualized(yearly_returns, acc.opening_date, true),
        yearly_returns,
      };
    });
}
