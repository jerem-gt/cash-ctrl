import type { Database } from 'better-sqlite3';

import { toEuros } from '../../lib/money';
import type { TaxBracket, TaxYearData, TaxYearParams } from './tax.types';

interface BracketRow {
  id: number;
  year: number;
  min_income_cents: number;
  max_income_cents: number | null;
  rate: number;
  created_at: string;
}

interface ParamsRow {
  year: number;
  abattement_rate: number;
  abattement_min_cents: number;
  abattement_max_cents: number;
  pass_cents: number;
  created_at: string;
}

function mapBracket(row: BracketRow): TaxBracket {
  return {
    id: row.id,
    year: row.year,
    min_income: toEuros(row.min_income_cents),
    max_income: row.max_income_cents == null ? null : toEuros(row.max_income_cents),
    rate: row.rate,
    created_at: row.created_at,
  };
}

function mapParams(row: ParamsRow): TaxYearParams {
  return {
    year: row.year,
    abattement_rate: row.abattement_rate,
    abattement_min: toEuros(row.abattement_min_cents),
    abattement_max: toEuros(row.abattement_max_cents),
    pass: toEuros(row.pass_cents),
    created_at: row.created_at,
  };
}

export function createTaxRepo(db: Database) {
  return {
    getAvailableYears(): number[] {
      return db
        .prepare<[], { year: number }>(
          'SELECT DISTINCT year FROM tax_year_params ORDER BY year DESC',
        )
        .all()
        .map((r) => r.year);
    },

    getYearData(year: number): TaxYearData | null {
      const paramsRow = db
        .prepare<[number], ParamsRow>('SELECT * FROM tax_year_params WHERE year = ?')
        .get(year);
      if (!paramsRow) return null;

      const bracketRows = db
        .prepare<
          [number],
          BracketRow
        >('SELECT * FROM tax_brackets WHERE year = ? ORDER BY min_income_cents')
        .all(year);

      return {
        year,
        params: mapParams(paramsRow),
        brackets: bracketRows.map(mapBracket),
      };
    },
  };
}
