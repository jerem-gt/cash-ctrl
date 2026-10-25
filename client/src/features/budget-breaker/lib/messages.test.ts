import { describe, expect, it } from 'vitest';

import i18n from '@/i18n';

import { pickHitMessage, pickLifeLostMessage } from './messages';

const t = i18n.getFixedT('fr', 'game');

describe('messages', () => {
  it('interpole le label dans le message de la catégorie', () => {
    const msg = pickHitMessage(t, 'account', 'Livret A', () => 0);
    expect(msg).toContain('Livret A');
    expect(msg).not.toContain('{{');
  });

  it('retombe sur la catégorie generic quand le label est vide', () => {
    const msg = pickHitMessage(t, 'button', '', () => 0);
    expect(msg).toBe("Paf. Ça, c'était probablement important.");
  });

  it('choisit un message selon le tirage', () => {
    const first = pickHitMessage(t, 'chart', '', () => 0);
    const last = pickHitMessage(t, 'chart', '', () => 0.999);
    expect(first).not.toBe(last);
  });

  it('retourne un message de vie perdue', () => {
    expect(pickLifeLostMessage(t, () => 0)).toContain('Balle perdue');
  });
});
