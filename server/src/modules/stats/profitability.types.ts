import type { YearlyReturn } from './stats.calculations';

export interface AccountProfitability {
  account_id: number;
  account_name: string;
  envelope_type: string | null;
  account_type: string;
  opening_date: string;
  capital_investi: number;
  capital_retire: number;
  valeur_actuelle: number;
  plus_value_absolue: number;
  rendement_total_pct: number;
  rendement_annualise_pct: number | null;
  yearly_returns: YearlyReturn[];
}
