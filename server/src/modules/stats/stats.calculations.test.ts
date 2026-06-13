import { describe, expect, it } from 'vitest';

import {
  addToFlowMap,
  buildFlowsByAccountYear,
  buildPositionsAt,
  buildYearlyReturn,
  type DatedFlow,
  firstDayOfMonth,
  getAllYears,
  groupByAccount,
  modifiedDietzDenominator,
  sumDeltasBefore,
  twrAnnualized,
  type YearlyReturn,
} from './stats.calculations';

// ─── getAllYears ──────────────────────────────────────────────────────────────

describe('getAllYears', () => {
  it('retourne toutes les années de openingDate à currentYear inclus', () => {
    expect(getAllYears('2021-03-15', 2024)).toEqual(['2021', '2022', '2023', '2024']);
  });

  it('retourne un tableau à un élément quand openingDate est dans currentYear', () => {
    expect(getAllYears('2024-01-01', 2024)).toEqual(['2024']);
  });
});

// ─── twrAnnualized ────────────────────────────────────────────────────────────

const makeReturn = (year: string, return_pct: number | null, is_ytd = false): YearlyReturn => ({
  year,
  start_value: 100,
  end_value: 110,
  net_flows: 0,
  gain: 10,
  return_pct,
  is_ytd,
});

describe('twrAnnualized', () => {
  it('retourne null pour un tableau vide', () => {
    expect(twrAnnualized([], '2020-01-01')).toBeNull();
  });

  it('retourne null quand la durée est inférieure à 6 mois', () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 3);
    const openingDate = recent.toISOString().slice(0, 10);
    expect(twrAnnualized([makeReturn('2024', 10)], openingDate)).toBeNull();
  });

  it('retourne null quand le TWR est ≤ -100%', () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 2);
    expect(twrAnnualized([makeReturn('2022', -100)], old.toISOString().slice(0, 10))).toBeNull();
  });

  it('ignore les returns_pct null dans le produit TWR', () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 2);
    const openingDate = old.toISOString().slice(0, 10);
    const withNull = twrAnnualized([makeReturn('2022', null), makeReturn('2023', 10)], openingDate);
    const withoutNull = twrAnnualized([makeReturn('2023', 10)], openingDate);
    expect(withNull).toBeCloseTo(withoutNull ?? 0, 5);
  });

  it('exclut les années YTD quand excludeYtd = true', () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 2);
    const openingDate = old.toISOString().slice(0, 10);
    const withYtd = [makeReturn('2022', 10), makeReturn('2023', 5, true)];
    const withoutYtd = [makeReturn('2022', 10)];
    const r1 = twrAnnualized(withYtd, openingDate, true);
    const r2 = twrAnnualized(withoutYtd, openingDate, true);
    expect(r1).toBeCloseTo(r2 ?? 0, 5);
  });
});

// ─── modifiedDietzDenominator ─────────────────────────────────────────────────

describe('modifiedDietzDenominator', () => {
  it("retourne startValue quand il n'y a pas de flux", () => {
    expect(modifiedDietzDenominator(1000, [], '2024-01-01', '2024-12-31')).toBe(1000);
  });

  it('retourne startValue quand la période est nulle', () => {
    expect(modifiedDietzDenominator(500, [], '2024-06-01', '2024-06-01')).toBe(500);
  });

  it('pondère un flux en début de période à ~1 (poids proche de 1)', () => {
    const flows: DatedFlow[] = [{ date: '2024-01-02', signed_cents: 100_00 }];
    const result = modifiedDietzDenominator(0, flows, '2024-01-01', '2024-12-31');
    expect(result).toBeGreaterThan(99); // flux de 100€ quasi entier
    expect(result).toBeLessThan(101);
  });

  it('pondère un flux en fin de période à ~0 (poids proche de 0)', () => {
    const flows: DatedFlow[] = [{ date: '2024-12-30', signed_cents: 100_00 }];
    const result = modifiedDietzDenominator(0, flows, '2024-01-01', '2024-12-31');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(1);
  });
});

// ─── buildPositionsAt ─────────────────────────────────────────────────────────

describe('buildPositionsAt', () => {
  it('calcule la position après un achat', () => {
    const ops = [
      {
        account_id: 1,
        ticker: 'AAPL',
        type: 'buy',
        quantity: 10,
        price_per_share: 150,
        date: '2024-01-01',
      },
    ];
    const positions = buildPositionsAt(ops, '2024-12-31');
    expect(positions.get('1:AAPL')).toEqual({ qty: 10, avgPrice: 150 });
  });

  it('met à jour le prix moyen après deux achats', () => {
    const ops = [
      {
        account_id: 1,
        ticker: 'AAPL',
        type: 'buy',
        quantity: 10,
        price_per_share: 100,
        date: '2024-01-01',
      },
      {
        account_id: 1,
        ticker: 'AAPL',
        type: 'buy',
        quantity: 10,
        price_per_share: 200,
        date: '2024-06-01',
      },
    ];
    const positions = buildPositionsAt(ops, '2024-12-31');
    expect(positions.get('1:AAPL')?.avgPrice).toBe(150);
    expect(positions.get('1:AAPL')?.qty).toBe(20);
  });

  it('réduit la quantité après une vente, ne va pas en dessous de 0', () => {
    const ops = [
      {
        account_id: 1,
        ticker: 'AAPL',
        type: 'buy',
        quantity: 10,
        price_per_share: 100,
        date: '2024-01-01',
      },
      {
        account_id: 1,
        ticker: 'AAPL',
        type: 'sell',
        quantity: 15,
        price_per_share: 120,
        date: '2024-06-01',
      },
    ];
    const positions = buildPositionsAt(ops, '2024-12-31');
    expect(positions.get('1:AAPL')?.qty).toBe(0);
  });

  it('ignore les opérations après yearEnd', () => {
    const ops = [
      {
        account_id: 1,
        ticker: 'AAPL',
        type: 'buy',
        quantity: 10,
        price_per_share: 100,
        date: '2025-01-01',
      },
    ];
    const positions = buildPositionsAt(ops, '2024-12-31');
    expect(positions.get('1:AAPL')).toBeUndefined();
  });

  it('gère le transfer_in comme un achat', () => {
    const ops = [
      {
        account_id: 2,
        ticker: 'MSFT',
        type: 'transfer_in',
        quantity: 5,
        price_per_share: 300,
        date: '2024-03-01',
      },
    ];
    const positions = buildPositionsAt(ops, '2024-12-31');
    expect(positions.get('2:MSFT')?.qty).toBe(5);
  });
});

// ─── sumDeltasBefore ─────────────────────────────────────────────────────────

describe('sumDeltasBefore', () => {
  it('retourne 0 pour une map undefined', () => {
    expect(sumDeltasBefore(undefined, 2023)).toBe(0);
  });

  it('retourne 0 quand toutes les années sont >= startYear', () => {
    const map = new Map([
      ['2023', 100],
      ['2024', 200],
    ]);
    expect(sumDeltasBefore(map, 2023)).toBe(0);
  });

  it('additionne uniquement les deltas des années strictement antérieures', () => {
    const map = new Map([
      ['2020', 100],
      ['2021', 200],
      ['2022', 300],
      ['2023', 400],
    ]);
    expect(sumDeltasBefore(map, 2022)).toBe(300);
  });
});

// ─── groupByAccount ───────────────────────────────────────────────────────────

describe('groupByAccount', () => {
  it('groupe les lignes par account_id', () => {
    const rows = [
      { account_id: 1, value: 'a' },
      { account_id: 2, value: 'b' },
      { account_id: 1, value: 'c' },
    ];
    const result = groupByAccount(rows);
    expect(result.get(1)).toEqual([
      { account_id: 1, value: 'a' },
      { account_id: 1, value: 'c' },
    ]);
    expect(result.get(2)).toEqual([{ account_id: 2, value: 'b' }]);
  });

  it("préserve l'ordre des lignes par account", () => {
    const rows = [
      { account_id: 1, year: '2021' },
      { account_id: 1, year: '2022' },
    ];
    const result = groupByAccount(rows);
    expect(result.get(1)?.map((r) => r.year)).toEqual(['2021', '2022']);
  });
});

// ─── addToFlowMap & buildFlowsByAccountYear ────────────────────────────────────

describe('addToFlowMap', () => {
  it('ajoute un flux dans la map', () => {
    const map = new Map<number, Map<string, DatedFlow[]>>();
    addToFlowMap(map, 1, '2024-03-15', 500_00);
    expect(map.get(1)?.get('2024')).toEqual([{ date: '2024-03-15', signed_cents: 500_00 }]);
  });

  it('regroupe les flux de la même année', () => {
    const map = new Map<number, Map<string, DatedFlow[]>>();
    addToFlowMap(map, 1, '2024-01-01', 100);
    addToFlowMap(map, 1, '2024-06-01', 200);
    expect(map.get(1)?.get('2024')).toHaveLength(2);
  });

  it("sépare les flux d'années différentes", () => {
    const map = new Map<number, Map<string, DatedFlow[]>>();
    addToFlowMap(map, 1, '2023-12-01', 100);
    addToFlowMap(map, 1, '2024-01-01', 200);
    expect(map.get(1)?.get('2023')).toHaveLength(1);
    expect(map.get(1)?.get('2024')).toHaveLength(1);
  });
});

describe('buildFlowsByAccountYear', () => {
  it("construit la map à partir d'un tableau de lignes", () => {
    const rows = [
      { account_id: 1, date: '2024-01-01', signed_cents: 100 },
      { account_id: 2, date: '2024-06-01', signed_cents: 200 },
      { account_id: 1, date: '2023-12-01', signed_cents: 50 },
    ];
    const result = buildFlowsByAccountYear(rows);
    expect(result.get(1)?.get('2024')).toHaveLength(1);
    expect(result.get(1)?.get('2023')).toHaveLength(1);
    expect(result.get(2)?.get('2024')).toHaveLength(1);
  });
});

// ─── buildYearlyReturn ────────────────────────────────────────────────────────

describe('buildYearlyReturn', () => {
  it('calcule correctement le gain et is_ytd', () => {
    const result = buildYearlyReturn('2023', 1000, 1100, 50, [], false, '2024-01-15');
    expect(result.gain).toBe(50); // 1100 - 1000 - 50
    expect(result.is_ytd).toBe(false);
    expect(result.year).toBe('2023');
    expect(result.net_flows).toBe(50);
  });

  it('retourne return_pct null quand le dénominateur est 0', () => {
    const result = buildYearlyReturn('2024', 0, 0, 0, [], true, '2024-01-01');
    expect(result.return_pct).toBeNull();
  });

  it("marque is_ytd = true pour l'année courante", () => {
    const result = buildYearlyReturn('2024', 100, 110, 0, [], true, '2024-06-15');
    expect(result.is_ytd).toBe(true);
  });

  it("utilise today comme fin de période pour l'année courante", () => {
    const result = buildYearlyReturn('2024', 1000, 1100, 0, [], true, '2024-06-15');
    expect(result.return_pct).not.toBeNull();
  });
});

// ─── firstDayOfMonth ─────────────────────────────────────────────────────────

describe('firstDayOfMonth', () => {
  it('retourne une date au format YYYY-MM-DD', () => {
    expect(firstDayOfMonth(0)).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('retourne le 1er du mois courant pour monthsBack = 0', () => {
    const now = new Date();
    const expected = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
    expect(firstDayOfMonth(0)).toBe(expected);
  });

  it('retourne le mois précédent pour monthsBack = 1', () => {
    const prev = new Date();
    prev.setUTCMonth(prev.getUTCMonth() - 1);
    const expected = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-01`;
    expect(firstDayOfMonth(1)).toBe(expected);
  });
});
