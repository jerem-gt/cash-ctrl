import { afterEach, describe, expect, it } from 'vitest';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(i18n.t('cle_inexistante' as any)).toBe('cle_inexistante');
  });

  it('retourne la clé (sans namespace) si la clé imbriquée est absente', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(i18n.t('section_inconnue.cle' as any, { ns: 'accounts' })).toBe('section_inconnue.cle');
  });
});

describe('i18n — langue du document', () => {
  afterEach(() => {
    document.head.querySelector('link[rel="manifest"]')?.remove();
  });

  it('suit la langue de l’interface : <html lang> et manifeste PWA', async () => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.append(link);

    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(link.getAttribute('href')).toBe('/manifest.en.webmanifest');

    await i18n.changeLanguage('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(link.getAttribute('href')).toBe('/manifest.webmanifest');
  });

  it('ramène une variante régionale à sa langue, sans manifeste lié (dev)', async () => {
    await i18n.changeLanguage('en-US');
    expect(document.documentElement.lang).toBe('en');
  });
});
