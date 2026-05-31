import { describe, expect, it } from 'vitest';

import { enrichBalanceHistory } from './dashboardBalance';

describe('enrichBalanceHistory', () => {
  it('renvoie des valeurs vides pour history undefined', () => {
    const e = enrichBalanceHistory(undefined);
    expect(e.types).toEqual([]);
    expect(e.dataWithTotal).toEqual([]);
    expect(e.negativeTypes.size).toBe(0);
    expect(e.lastPositiveType).toBeUndefined();
    expect(e.hasLoans).toBe(false);
  });

  it('calcule _total par mois (somme des types)', () => {
    const e = enrichBalanceHistory({
      account_types: ['liquidites', 'epargne'],
      data: [{ month: '2026-01', liquidites: 1000, epargne: 500 }],
    });
    expect(e.dataWithTotal[0]._total).toBe(1500);
  });

  it('ignore les champs absents (treat as 0) pour _total', () => {
    const e = enrichBalanceHistory({
      account_types: ['liquidites', 'epargne'],
      data: [{ month: '2026-01', liquidites: 1000 }],
    });
    expect(e.dataWithTotal[0]._total).toBe(1000);
  });

  it('détecte les types avec valeur négative (prêts)', () => {
    const e = enrichBalanceHistory({
      account_types: ['liquidites', 'prets'],
      data: [{ month: '2026-01', liquidites: 1000, prets: -500 }],
    });
    expect(e.negativeTypes.has('prets')).toBe(true);
    expect(e.negativeTypes.has('liquidites')).toBe(false);
  });

  it('lastPositiveType = dernier type non-négatif', () => {
    const e = enrichBalanceHistory({
      account_types: ['liquidites', 'epargne', 'prets'],
      data: [{ month: '2026-01', liquidites: 1000, epargne: 500, prets: -100 }],
    });
    expect(e.lastPositiveType).toBe('epargne');
  });

  it('lastPositiveType undefined si tous les types sont négatifs', () => {
    const e = enrichBalanceHistory({
      account_types: ['prets'],
      data: [{ month: '2026-01', prets: -500 }],
    });
    expect(e.lastPositiveType).toBeUndefined();
  });

  it('hasLoans true ssi un prets négatif existe', () => {
    const positive = enrichBalanceHistory({
      account_types: ['prets'],
      data: [{ month: '2026-01', prets: 0 }],
    });
    expect(positive.hasLoans).toBe(false);

    const negative = enrichBalanceHistory({
      account_types: ['prets'],
      data: [{ month: '2026-01', prets: -100 }],
    });
    expect(negative.hasLoans).toBe(true);
  });
});
