import { describe, expect, it } from 'vitest';

import type { Bank } from '@/types';

import { findBankByName } from './Shared';

function makeBank(id: number, name: string): Bank {
  return { id, name, logo: null, login_url: null, sort_order: id };
}

describe('findBankByName', () => {
  const banks: Bank[] = [
    makeBank(1, 'BNP Paribas'),
    makeBank(2, 'Boursorama'),
    makeBank(3, 'Crédit Mutuel'),
  ];

  it('renvoie le premier id quand bankname est vide', () => {
    expect(findBankByName('', banks)).toBe(1);
  });

  it('renvoie null quand bankname est vide et liste vide', () => {
    expect(findBankByName('', [])).toBeNull();
  });

  it('match exact insensible à la casse', () => {
    expect(findBankByName('boursorama', banks)).toBe(2);
    expect(findBankByName('BOURSORAMA', banks)).toBe(2);
    expect(findBankByName('Boursorama', banks)).toBe(2);
  });

  it('match partial : bankname contenu dans le nom de banque', () => {
    expect(findBankByName('BNP', banks)).toBe(1);
  });

  it('match partial : nom de banque contenu dans bankname', () => {
    // "BNP Paribas Particuliers" contient "BNP Paribas" → match partial
    expect(findBankByName('BNP Paribas Particuliers', banks)).toBe(1);
  });

  it('fallback sur le premier id quand aucun match (partiel ni exact)', () => {
    expect(findBankByName('BanqueInconnue', banks)).toBe(1);
  });

  it('renvoie null quand aucun match et liste vide', () => {
    expect(findBankByName('Whatever', [])).toBeNull();
  });

  it('le match exact prime sur le partial', () => {
    const banks2: Bank[] = [
      makeBank(1, 'BNP Paribas'),
      makeBank(2, 'BNP'), // exact match si on cherche "BNP"
    ];
    expect(findBankByName('BNP', banks2)).toBe(2);
  });
});
