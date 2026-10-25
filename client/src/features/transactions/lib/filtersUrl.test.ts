import type { Filters } from '@cashctrl/types';
import { describe, expect, it } from 'vitest';

import { buildTransactionsUrl, parseTxSearch, toTxSearch } from './filtersUrl';

const parse = (qs: string) => parseTxSearch(new URLSearchParams(qs));

describe('parseTxSearch', () => {
  it('retourne des filtres vides et la page 1 sans paramètre', () => {
    expect(parse('')).toEqual({ filters: {}, page: 1 });
  });

  it('lit tous les paramètres valides', () => {
    const { filters, page } = parse(
      'q=chat&type=expense&account_id=1&category_id=2&subcategory_id=3&payment_method_id=4' +
        '&date_from=2026-01-01&date_to=2026-01-31&amount_min=10.5&amount_max=99&validated=false&page=3',
    );
    expect(filters).toEqual({
      description_contains: 'chat',
      type: 'expense',
      account_id: 1,
      category_id: 2,
      subcategory_id: 3,
      payment_method_id: 4,
      date_from: '2026-01-01',
      date_to: '2026-01-31',
      amount_min: 10.5,
      amount_max: 99,
      validated: false,
    });
    expect(page).toBe(3);
  });

  it.each(['0', '-1', 'abc', '1.5', '', '1e3'])('ignore un id invalide (%s)', (v) => {
    expect(parse(`account_id=${v}&category_id=${v}&payment_method_id=${v}`).filters).toEqual({});
  });

  it('ignore un type invalide', () => {
    expect(parse('type=transfer').filters).toEqual({});
  });

  it.each(['2026-1-01', '01/01/2026', 'abc', ''])('ignore une date invalide (%s)', (v) => {
    expect(parse(`date_from=${v}&date_to=${v}`).filters).toEqual({});
  });

  it.each(['abc', 'Infinity', 'NaN', ''])('ignore un montant invalide (%s)', (v) => {
    expect(parse(`amount_min=${v}&amount_max=${v}`).filters).toEqual({});
  });

  it('ignore une virgule décimale', () => {
    expect(parse('amount_min=1,5').filters).toEqual({});
  });

  it.each(['0', '-2', 'abc', '1.5', ''])('retombe sur la page 1 si page=%s', (v) => {
    expect(parse(`page=${v}`).page).toBe(1);
  });

  it('lit validated=true et validated=false', () => {
    expect(parse('validated=true').filters).toEqual({ validated: true });
    expect(parse('validated=false').filters).toEqual({ validated: false });
  });

  it.each(['1', 'oui', ''])('ignore validated invalide (%s)', (v) => {
    expect(parse(`validated=${v}`).filters).toEqual({});
  });

  it('lit exclude_transfers=true et ignore toute autre valeur', () => {
    expect(parse('exclude_transfers=true').filters).toEqual({ exclude_transfers: true });
    expect(parse('exclude_transfers=false').filters).toEqual({});
    expect(parse('exclude_transfers=1').filters).toEqual({});
  });

  it('omet exclude_transfers quand false ou absent', () => {
    expect(toTxSearch({ exclude_transfers: false }, 1).toString()).toBe('');
    expect(toTxSearch({ exclude_transfers: true }, 1).toString()).toBe('exclude_transfers=true');
  });

  it('lit category_id=none', () => {
    expect(parse('category_id=none').filters).toEqual({ category_id: 'none' });
  });

  it('supprime subcategory_id avec category_id=none', () => {
    expect(parse('category_id=none&subcategory_id=3').filters).toEqual({ category_id: 'none' });
  });

  it('trim q et traite le vide comme absent', () => {
    expect(parse('q=%20%20chat%20').filters.description_contains).toBe('chat');
    expect(parse('q=%20%20').filters).toEqual({});
  });

  it('supprime subcategory_id sans category_id', () => {
    expect(parse('subcategory_id=3').filters).toEqual({});
    expect(parse('category_id=2&subcategory_id=3').filters).toEqual({
      category_id: 2,
      subcategory_id: 3,
    });
  });

  it('ne lit jamais scheduled_id ni exclude_linked_reimbursements', () => {
    expect(parse('scheduled_id=5&exclude_linked_reimbursements=true').filters).toEqual({});
  });
});

describe('toTxSearch', () => {
  it('omet les valeurs par défaut et vides', () => {
    const filters: Filters = { description_contains: '  ', type: undefined, validated: undefined };
    expect(toTxSearch(filters, 1).toString()).toBe('');
  });

  it('ne sérialise pas scheduled_id ni exclude_linked_reimbursements', () => {
    expect(toTxSearch({ scheduled_id: 5, exclude_linked_reimbursements: true }, 1).toString()).toBe(
      '',
    );
  });

  it('écrit les clés dans un ordre fixe, q en premier, page en dernier', () => {
    const filters: Filters = {
      exclude_transfers: true,
      validated: false,
      amount_max: 20,
      amount_min: 5,
      date_to: '2026-02-01',
      date_from: '2026-01-01',
      payment_method_id: 4,
      subcategory_id: 3,
      category_id: 2,
      account_id: 1,
      type: 'income',
      description_contains: 'chat',
    };
    expect([...toTxSearch(filters, 2).keys()]).toEqual([
      'q',
      'type',
      'account_id',
      'category_id',
      'subcategory_id',
      'payment_method_id',
      'date_from',
      'date_to',
      'amount_min',
      'amount_max',
      'validated',
      'exclude_transfers',
      'page',
    ]);
  });

  it('écrit les montants avec un point décimal', () => {
    expect(toTxSearch({ amount_min: 10.5 }, 1).get('amount_min')).toBe('10.5');
  });

  it('aller-retour parse/toSearch', () => {
    const filters: Filters = {
      description_contains: 'café',
      type: 'expense',
      account_id: 1,
      category_id: 2,
      subcategory_id: 3,
      amount_min: 1.25,
      validated: false,
    };
    expect(parseTxSearch(toTxSearch(filters, 4))).toEqual({ filters, page: 4 });
  });
});

describe('buildTransactionsUrl', () => {
  it('retourne /transactions sans filtre', () => {
    expect(buildTransactionsUrl({})).toBe('/transactions');
    expect(buildTransactionsUrl({ description_contains: '  ' })).toBe('/transactions');
  });

  it('sérialise validated true/false et category_id none', () => {
    expect(buildTransactionsUrl({ validated: true })).toBe('/transactions?validated=true');
    expect(buildTransactionsUrl({ validated: false })).toBe('/transactions?validated=false');
    expect(buildTransactionsUrl({ type: 'expense', category_id: 'none', validated: true })).toBe(
      '/transactions?type=expense&category_id=none&validated=true',
    );
  });

  it('ajoute les filtres en query string', () => {
    expect(buildTransactionsUrl({ description_contains: 'caf', type: 'expense' })).toBe(
      '/transactions?q=caf&type=expense',
    );
  });
});
