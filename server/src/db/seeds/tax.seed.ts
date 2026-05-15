import type { Database } from 'better-sqlite3';

import { toCents } from '../../lib/money';

interface BracketDef {
  min_income: number; // euros
  max_income: number | null; // euros, null = tranche haute
  rate: number; // %
}

interface YearDef {
  year: number;
  abattement_rate: number;
  abattement_min: number; // euros
  abattement_max: number; // euros
  pass: number; // euros (Plafond Annuel de la Sécurité Sociale)
  brackets: BracketDef[];
}

const TAX_YEARS: YearDef[] = [
  {
    year: 2024,
    abattement_rate: 0.1,
    abattement_min: 448,
    abattement_max: 13522,
    pass: 46368,
    brackets: [
      { min_income: 0, max_income: 11294, rate: 0 },
      { min_income: 11294, max_income: 28797, rate: 11 },
      { min_income: 28797, max_income: 82341, rate: 30 },
      { min_income: 82341, max_income: 177106, rate: 41 },
      { min_income: 177106, max_income: null, rate: 45 },
    ],
  },
  {
    year: 2025,
    abattement_rate: 0.1,
    abattement_min: 495,
    abattement_max: 14171,
    pass: 47100,
    brackets: [
      { min_income: 0, max_income: 11497, rate: 0 },
      { min_income: 11497, max_income: 29315, rate: 11 },
      { min_income: 29315, max_income: 83823, rate: 30 },
      { min_income: 83823, max_income: 180294, rate: 41 },
      { min_income: 180294, max_income: null, rate: 45 },
    ],
  },
  {
    year: 2026,
    abattement_rate: 0.1,
    abattement_min: 509,
    abattement_max: 14555,
    pass: 48060,
    brackets: [
      { min_income: 0, max_income: 11600, rate: 0 },
      { min_income: 11600, max_income: 29579, rate: 11 },
      { min_income: 29579, max_income: 84577, rate: 30 },
      { min_income: 84577, max_income: 181917, rate: 41 },
      { min_income: 181917, max_income: null, rate: 45 },
    ],
  },
];

export function seedTaxData(db: Database) {
  const insertParams = db.prepare(`
    INSERT OR IGNORE INTO tax_year_params
      (year, abattement_rate, abattement_min_cents, abattement_max_cents, pass_cents)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertBracket = db.prepare(`
    INSERT OR IGNORE INTO tax_brackets
      (year, min_income_cents, max_income_cents, rate)
    SELECT ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM tax_brackets WHERE year = ? AND min_income_cents = ?)
  `);

  db.transaction(() => {
    for (const y of TAX_YEARS) {
      insertParams.run(
        y.year,
        y.abattement_rate,
        toCents(y.abattement_min),
        toCents(y.abattement_max),
        toCents(y.pass),
      );
      for (const b of y.brackets) {
        const minCents = toCents(b.min_income);
        const maxCents = b.max_income != null ? toCents(b.max_income) : null;
        insertBracket.run(y.year, minCents, maxCents, b.rate, y.year, minCents);
      }
    }
  })();
}
