import { describe, expect, it } from 'vitest';

import { computeRunningBalances } from './balance';

describe('computeRunningBalances', () => {
  it('retourne un tableau vide pour une liste vide', () => {
    expect(computeRunningBalances([], 1000)).toEqual([]);
  });

  it('retourne le solde courant pour la transaction la plus récente (revenu)', () => {
    expect(
      computeRunningBalances([{ type: 'income', amount: 200, loan_principal: null }], 1200),
    ).toEqual([1200]);
  });

  it('retourne le solde courant pour la transaction la plus récente (dépense)', () => {
    expect(
      computeRunningBalances([{ type: 'expense', amount: 50, loan_principal: null }], 950),
    ).toEqual([950]);
  });

  it('calcule les soldes consécutifs (revenu puis dépense, ordre récent→ancien)', () => {
    // ordre: tx[0]=revenu 200, tx[1]=dépense 50 — currentBalance=1200
    // tx[0] balance = 1200 ; avant tx[0] = 1200 - 200 = 1000
    // tx[1] balance = 1000 ; avant tx[1] = 1000 + 50 = 1050
    const txs = [
      { type: 'income' as const, amount: 200, loan_principal: null },
      { type: 'expense' as const, amount: 50, loan_principal: null },
    ];
    expect(computeRunningBalances(txs, 1200)).toEqual([1200, 1000]);
  });

  it('calcule les soldes pour plusieurs dépenses consécutives', () => {
    const txs = [
      { type: 'expense' as const, amount: 100, loan_principal: null },
      { type: 'expense' as const, amount: 50, loan_principal: null },
    ];
    // currentBalance=850 : après exp100, avant : 950 ; après exp50, avant : 1000
    expect(computeRunningBalances(txs, 850)).toEqual([850, 950]);
  });

  it('arrondit à 2 décimales pour éviter les erreurs flottantes', () => {
    const txs = [
      { type: 'expense' as const, amount: 0.1, loan_principal: null },
      { type: 'expense' as const, amount: 0.2, loan_principal: null },
    ];
    // currentBalance = 9.7 ; après exp0.2 : 9.7 + 0.2 = 9.9 (sans arrondi = 9.899999...)
    expect(computeRunningBalances(txs, 9.7)).toEqual([9.7, 9.8]);
  });

  it('gère un solde négatif', () => {
    const txs = [{ type: 'expense' as const, amount: 500, loan_principal: null }];
    expect(computeRunningBalances(txs, -200)).toEqual([-200]);
  });
});
