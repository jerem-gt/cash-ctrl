import { describe, expect, it } from 'vitest';

import { categoryTransactionsUrl, monthRange, statsTransactionsUrl, yearRange } from './txLinks';

describe('monthRange', () => {
  it('retourne le premier et le dernier jour du mois en date locale', () => {
    expect(monthRange(new Date(2026, 9, 25))).toEqual({
      date_from: '2026-10-01',
      date_to: '2026-10-31',
    });
  });

  it('gère février bissextile et le 1er du mois à minuit', () => {
    expect(monthRange(new Date(2028, 1, 1, 0, 0, 0))).toEqual({
      date_from: '2028-02-01',
      date_to: '2028-02-29',
    });
  });
});

describe('yearRange', () => {
  it('couvre du 1er janvier au 31 décembre', () => {
    expect(yearRange(2025)).toEqual({ date_from: '2025-01-01', date_to: '2025-12-31' });
  });
});

describe('statsTransactionsUrl', () => {
  it('ajoute validated=true et exclude_transfers=true', () => {
    expect(statsTransactionsUrl({ type: 'income' })).toBe(
      '/transactions?type=income&validated=true&exclude_transfers=true',
    );
  });
});

describe('categoryTransactionsUrl', () => {
  const range = yearRange(2026);

  it('construit l’URL avec la catégorie, le type et validated=true&exclude_transfers=true', () => {
    expect(categoryTransactionsUrl({ type: 'expense', categoryId: 3, range })).toBe(
      '/transactions?type=expense&category_id=3&date_from=2026-01-01&date_to=2026-12-31&validated=true&exclude_transfers=true',
    );
  });

  it('utilise none pour un groupe sans catégorie et ajoute le compte', () => {
    expect(categoryTransactionsUrl({ type: 'income', categoryId: null, range, accountId: 2 })).toBe(
      '/transactions?type=income&account_id=2&category_id=none&date_from=2026-01-01&date_to=2026-12-31&validated=true&exclude_transfers=true',
    );
  });
});
