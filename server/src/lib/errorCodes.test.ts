import { describe, expect, it } from 'vitest';

import { buildError, ERROR_MESSAGES, renderMessage } from './errorCodes';

describe('renderMessage', () => {
  it('retourne le template tel quel sans params', () => {
    expect(renderMessage('account.not_found')).toBe('Compte introuvable');
  });

  it('interpole les placeholders {{x}}', () => {
    expect(renderMessage('bank.in_use', { count: 3 })).toBe(
      'Cette banque est utilisée par 3 compte(s).',
    );
  });

  it('interpole plusieurs placeholders', () => {
    expect(
      renderMessage('insurance.insufficient_balance_support', {
        support: 'Fonds €',
        balance: '12.50',
      }),
    ).toBe('Solde insuffisant sur Fonds € : 12.50 €');
  });

  it('laisse le placeholder intact si le param est absent', () => {
    expect(renderMessage('tax.bracket_not_found')).toBe('Barème {{year}} introuvable');
  });
});

describe('buildError', () => {
  it('construit le corps avec code et message rendu', () => {
    expect(buildError('account.not_found')).toEqual({
      code: 'account.not_found',
      message: 'Compte introuvable',
    });
  });

  it('inclut params et les interpole dans message', () => {
    expect(buildError('stock.price_not_found', { ticker: 'AAPL' })).toEqual({
      code: 'stock.price_not_found',
      message: 'Cotation introuvable pour AAPL',
      params: { ticker: 'AAPL' },
    });
  });
});

describe('ERROR_MESSAGES', () => {
  it('tous les templates sont des chaînes non vides', () => {
    for (const [code, msg] of Object.entries(ERROR_MESSAGES)) {
      expect(msg, code).toBeTypeOf('string');
      expect(msg.length, code).toBeGreaterThan(0);
    }
  });
});
