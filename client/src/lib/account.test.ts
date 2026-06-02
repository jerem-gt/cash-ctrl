import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import type { Account, Bank } from '@/types';

import { accountSeniority, bankSortOrderMap, groupAccountsByBank } from './account';

const t = i18n.getFixedT('fr', 'accounts');

function makeAccount(id: number, name: string, bank: string | null): Account {
  return {
    id,
    name,
    bank_id: null,
    bank: bank ?? '',
    account_type_id: null,
    type: '',
    envelope_type: null,
    initial_balance: 0,
    opening_date: null,
    closed_at: null,
    balance: 0,
    balance_all: 0,
    balance_stocks: 0,
    balance_insurance: 0,
    capital_restant_du: null,
    capital_restant_du_all: null,
  };
}

function makeBank(name: string, sort_order: number): Bank {
  return { id: 1, name, logo: null, domain: null, sort_order };
}

describe('accountSeniority', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25'));
  });
  afterEach(() => vi.useRealTimers());

  it(`retourne "moins d'un mois" pour le jour même`, () => {
    expect(accountSeniority('2026-04-25', t)).toBe("moins d'un mois");
  });

  it(`retourne "moins d'un mois" si < 1 mois complet dans le même mois`, () => {
    expect(accountSeniority('2026-04-01', t)).toBe("moins d'un mois");
  });

  it(`retourne "moins d'un mois" si le jour d'ouverture > jour courant (mois non complet)`, () => {
    // 25 < 26, donc on retire 1 mois → 0 mois
    expect(accountSeniority('2026-03-26', t)).toBe("moins d'un mois");
  });

  it(`retourne "1 mois" pour exactement 1 mois`, () => {
    expect(accountSeniority('2026-03-25', t)).toBe('1 mois');
  });

  it(`retourne "N mois" pour plusieurs mois (même année)`, () => {
    expect(accountSeniority('2026-02-25', t)).toBe('2 mois');
  });

  it(`retourne "1 an" pour exactement 1 an`, () => {
    expect(accountSeniority('2025-04-25', t)).toBe('1 an');
  });

  it(`retourne "2 ans" pour exactement 2 ans`, () => {
    expect(accountSeniority('2024-04-25', t)).toBe('2 ans');
  });

  it(`retourne "1 an N mois" pour une ancienneté mixte`, () => {
    expect(accountSeniority('2024-10-25', t)).toBe('1 an 6 mois');
  });

  it(`retourne "N ans N mois" pour une longue ancienneté`, () => {
    expect(accountSeniority('2023-01-25', t)).toBe('3 ans 3 mois');
  });
});

describe('bankSortOrderMap', () => {
  it('renvoie un map { name → sort_order }', () => {
    const banks = [makeBank('BNP', 1), makeBank('Boursorama', 5)];
    expect(bankSortOrderMap(banks)).toEqual({ BNP: 1, Boursorama: 5 });
  });

  it('renvoie un map vide pour une liste vide', () => {
    expect(bankSortOrderMap([])).toEqual({});
  });
});

describe('groupAccountsByBank', () => {
  it('groupe par nom de banque', () => {
    const accounts = [
      makeAccount(1, 'CC BNP', 'BNP'),
      makeAccount(2, 'Livret BNP', 'BNP'),
      makeAccount(3, 'CC Bourso', 'Boursorama'),
    ];
    const result = groupAccountsByBank(accounts, { BNP: 1, Boursorama: 2 });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      bank: 'BNP',
      accounts: [accounts[0], accounts[1]],
    });
    expect(result[1]).toEqual({ bank: 'Boursorama', accounts: [accounts[2]] });
  });

  it('trie selon sort_order', () => {
    const accounts = [makeAccount(1, 'CC Bourso', 'Boursorama'), makeAccount(2, 'CC BNP', 'BNP')];
    const result = groupAccountsByBank(accounts, { BNP: 1, Boursorama: 2 });
    expect(result.map((g) => g.bank)).toEqual(['BNP', 'Boursorama']);
  });

  it('range les comptes sans banque en dernier (bank: null)', () => {
    const accounts = [makeAccount(1, 'Sans banque', null), makeAccount(2, 'CC BNP', 'BNP')];
    const result = groupAccountsByBank(accounts, { BNP: 1 });
    expect(result.map((g) => g.bank)).toEqual(['BNP', null]);
  });

  it('trie alphabétiquement à sort_order égal', () => {
    const accounts = [makeAccount(1, 'Zoo', 'Zeta'), makeAccount(2, 'Alpha', 'Alpha')];
    const result = groupAccountsByBank(accounts, {});
    expect(result.map((g) => g.bank)).toEqual(['Alpha', 'Zeta']);
  });

  it('place les banques sans sort_order après celles avec', () => {
    const accounts = [makeAccount(1, 'A', 'BankInconnue'), makeAccount(2, 'B', 'BNP')];
    const result = groupAccountsByBank(accounts, { BNP: 1 });
    expect(result.map((g) => g.bank)).toEqual(['BNP', 'BankInconnue']);
  });

  it('renvoie un tableau vide pour une liste vide', () => {
    expect(groupAccountsByBank([], {})).toEqual([]);
  });
});
