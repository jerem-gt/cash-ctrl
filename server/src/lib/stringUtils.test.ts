import { describe, expect, it } from 'vitest';

import { toFileName } from './stringUtils';

describe('toFileName', () => {
  it('devrait transformer en minuscules', () => {
    expect(toFileName('COMPTE')).toBe('compte');
  });

  it('devrait supprimer les accents (é, è, ê, ë -> e)', () => {
    expect(toFileName('Crédit Épargne')).toBe('credit-epargne');
    expect(toFileName('À l’aube')).toBe('a-l-aube');
  });

  it('devrait remplacer les espaces par des tirets', () => {
    expect(toFileName('mon compte bancaire')).toBe('mon-compte-bancaire');
  });

  it('devrait gérer les espaces multiples et caractères spéciaux', () => {
    expect(toFileName('Compte   Boursorama !!!')).toBe('compte-boursorama');
    expect(toFileName('Épargne & Retraite @2024')).toBe('epargne-retraite-2024');
  });

  it('ne devrait pas commencer ni finir par un tiret', () => {
    expect(toFileName('---Hello World---')).toBe('hello-world');
    expect(toFileName('! Attention !')).toBe('attention');
  });

  it('devrait conserver les chiffres', () => {
    expect(toFileName('Compte 123')).toBe('compte-123');
  });

  it('devrait gérer une chaîne vide ou composée uniquement de caractères interdits', () => {
    expect(toFileName('!!!')).toBe('');
    expect(toFileName('')).toBe('');
  });

  it('devrait être robuste face à une chaîne très longue (limite DoS)', () => {
    const longString = 'a'.repeat(1000) + '!!!';
    const result = toFileName(longString);
    expect(result).toBe('a'.repeat(1000));
    expect(result.length).toBe(1000);
  });
});
