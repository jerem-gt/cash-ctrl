import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  invalidateBalances,
  invalidateFrequentTransactions,
  invalidatePortfolio,
  invalidateTransactions,
} from './invalidate';

function keysInvalidatedBy(fn: (qc: QueryClient) => void) {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries');
  fn(qc);
  return spy.mock.calls.map(([filters]) => filters?.queryKey);
}

describe('invalidate', () => {
  it('invalidateBalances couvre tout ce qui dépend des soldes', () => {
    expect(keysInvalidatedBy(invalidateBalances)).toEqual([
      ['accounts'],
      ['dashboard-stats'],
      ['forecast'],
      ['account-balance-history'],
      ['balance-history'],
      ['profitability'],
    ]);
  });

  it('invalidateTransactions cible toutes les listes de transactions', () => {
    expect(keysInvalidatedBy(invalidateTransactions)).toEqual([
      ['transactions'],
      ['frequent-transactions'],
    ]);
  });

  it('invalidateFrequentTransactions cible uniquement les suggestions', () => {
    expect(keysInvalidatedBy(invalidateFrequentTransactions)).toEqual([['frequent-transactions']]);
  });

  it('invalidatePortfolio cible positions et opérations de bourse', () => {
    expect(keysInvalidatedBy(invalidatePortfolio)).toEqual([
      ['stock-positions'],
      ['stock-operations'],
    ]);
  });
});
