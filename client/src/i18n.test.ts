import { describe, expect, it } from 'vitest';

import i18n from '@/i18n';

describe('i18n — namespace common', () => {
  it('résout les clés de base', () => {
    expect(i18n.t('cancel', { ns: 'common' })).toBe('Annuler');
    expect(i18n.t('save', { ns: 'common' })).toBe('Enregistrer');
    expect(i18n.t('loading', { ns: 'common' })).toBe('…');
  });

  it('utilise common comme namespace par défaut', () => {
    expect(i18n.t('cancel')).toBe('Annuler');
  });
});

describe('i18n — namespace accounts', () => {
  it('résout les clés imbriquées', () => {
    expect(i18n.t('close_modal.title', { ns: 'accounts' })).toBe('Clôturer le compte');
    expect(i18n.t('close_modal.close_btn', { ns: 'accounts' })).toBe('Clôturer');
  });

  it('interpole les variables dans balance_warning', () => {
    const result = i18n.t('close_modal.balance_warning', {
      ns: 'accounts',
      balance: '500,00 €',
    });
    expect(result).toContain('500,00 €');
    expect(result).toContain('virement de clôture');
  });
});

describe('i18n — comportement sur clé manquante', () => {
  it("retourne la clé si elle n'existe pas", () => {
    expect(i18n.t('cle_inexistante')).toBe('cle_inexistante');
  });

  it('retourne la clé (sans namespace) si la clé imbriquée est absente', () => {
    expect(i18n.t('section_inconnue.cle', { ns: 'accounts' })).toBe('section_inconnue.cle');
  });
});
