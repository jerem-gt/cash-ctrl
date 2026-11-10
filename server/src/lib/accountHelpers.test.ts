import { describe, expect, it } from 'vitest';

import { setupFixtures } from '../tests/helpers/testDb.js';
import { assertOwnedAccount } from './accountHelpers.js';

describe('assertOwnedAccount', () => {
  const { db, userId, accountId } = setupFixtures();

  it('laisse passer un compte de l’utilisateur', () => {
    expect(() => assertOwnedAccount(db, accountId, userId)).not.toThrow();
  });

  it('lève 404 account.not_found pour le compte d’un autre utilisateur ou inexistant', () => {
    expect(() => assertOwnedAccount(db, accountId, userId + 1)).toThrow(
      expect.objectContaining({ status: 404, code: 'account.not_found' }),
    );
    expect(() => assertOwnedAccount(db, 9999, userId)).toThrow(
      expect.objectContaining({ status: 404, code: 'account.not_found' }),
    );
  });

  it('lève le code fourni', () => {
    expect(() =>
      assertOwnedAccount(db, accountId, userId + 1, 'stock.source_account_not_found'),
    ).toThrow(expect.objectContaining({ code: 'stock.source_account_not_found' }));
  });
});
