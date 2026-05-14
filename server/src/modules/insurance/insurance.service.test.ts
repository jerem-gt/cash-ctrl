import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestDb, seedTestReferenceData } from '../../tests/helpers/testDb.js';
import { recalcUcPosition, refreshInsurancePrices } from './insurance.service.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function setupDb() {
  const db = createTestDb();
  const userId = Number(
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('u', 'x')
      .lastInsertRowid,
  );
  seedTestReferenceData(db, userId);
  const accountId = Number(
    db
      .prepare(
        'INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(userId, 'AV', 1, 4, 0, '2024-01-01').lastInsertRowid,
  );
  const supportId = Number(
    db
      .prepare(
        "INSERT INTO insurance_supports (user_id, account_id, name, type, ticker) VALUES (?, ?, ?, 'uc', ?)",
      )
      .run(userId, accountId, 'Fonds UC', 'DCAM.PA').lastInsertRowid,
  );
  return { db, userId, accountId, supportId };
}

function insertOp(
  db: ReturnType<typeof createTestDb>,
  ctx: { userId: number; accountId: number; supportId: number },
  type: string,
  quantity: number | null,
  pricePerUnit: number | null,
) {
  db.prepare(
    `INSERT INTO insurance_operations
       (user_id, account_id, support_id, type, quantity, price_per_unit, amount, fees, date)
       VALUES (?, ?, ?, ?, ?, ?, 100000, 0, '2024-01-01')`,
  ).run(ctx.userId, ctx.accountId, ctx.supportId, type, quantity, pricePerUnit);
}

function getPosition(db: ReturnType<typeof createTestDb>, supportId: number) {
  return db
    .prepare('SELECT quantity, avg_price FROM insurance_positions WHERE support_id = ?')
    .get(supportId) as { quantity: number; avg_price: number } | undefined;
}

// ─── recalcUcPosition ─────────────────────────────────────────────────────────

describe('recalcUcPosition', () => {
  it('crée une position après un versement', () => {
    const { db, userId, accountId, supportId } = setupDb();
    insertOp(db, { userId, accountId, supportId }, 'versement', 10, 1500);

    recalcUcPosition(db, accountId, supportId, userId);

    const pos = getPosition(db, supportId);
    expect(pos?.quantity).toBeCloseTo(10);
    expect(pos?.avg_price).toBeCloseTo(1500);
  });

  it('recalcule le PRU moyen pondéré sur plusieurs versements', () => {
    const { db, userId, accountId, supportId } = setupDb();
    insertOp(db, { userId, accountId, supportId }, 'versement', 10, 1000);
    insertOp(db, { userId, accountId, supportId }, 'versement', 10, 2000);

    recalcUcPosition(db, accountId, supportId, userId);

    const pos = getPosition(db, supportId);
    expect(pos?.quantity).toBeCloseTo(20);
    expect(pos?.avg_price).toBeCloseTo(1500);
  });

  it('réduit la quantité après un rachat', () => {
    const { db, userId, accountId, supportId } = setupDb();
    insertOp(db, { userId, accountId, supportId }, 'versement', 10, 1500);
    insertOp(db, { userId, accountId, supportId }, 'rachat', 3, 1600);

    recalcUcPosition(db, accountId, supportId, userId);

    const pos = getPosition(db, supportId);
    expect(pos?.quantity).toBeCloseTo(7);
  });

  it('supprime la position quand la quantité tombe à zéro', () => {
    const { db, userId, accountId, supportId } = setupDb();
    insertOp(db, { userId, accountId, supportId }, 'versement', 5, 1500);
    insertOp(db, { userId, accountId, supportId }, 'rachat', 5, 1600);
    db.prepare(
      `INSERT INTO insurance_positions (user_id, account_id, support_id, quantity, avg_price, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ).run(userId, accountId, supportId, 5, 1500);

    recalcUcPosition(db, accountId, supportId, userId);

    expect(getPosition(db, supportId)).toBeUndefined();
  });

  it('gère les arbitrages (arbitrage_in / arbitrage_out)', () => {
    const { db, userId, accountId, supportId } = setupDb();
    insertOp(db, { userId, accountId, supportId }, 'versement', 10, 1000);
    insertOp(db, { userId, accountId, supportId }, 'arbitrage_out', 4, 1200);
    insertOp(db, { userId, accountId, supportId }, 'arbitrage_in', 3, 1300);

    recalcUcPosition(db, accountId, supportId, userId);

    const pos = getPosition(db, supportId);
    expect(pos?.quantity).toBeCloseTo(9);
  });

  it('gère les opérations avec quantity null (interets)', () => {
    const { db, userId, accountId, supportId } = setupDb();
    insertOp(db, { userId, accountId, supportId }, 'versement', 10, 1500);
    // interets ne modifie pas la quantité (type non reconnu → ignoré)
    insertOp(db, { userId, accountId, supportId }, 'interets', null, null);

    recalcUcPosition(db, accountId, supportId, userId);

    const pos = getPosition(db, supportId);
    expect(pos?.quantity).toBeCloseTo(10);
  });
});

// ─── refreshInsurancePrices ───────────────────────────────────────────────────

describe('refreshInsurancePrices', () => {
  it('rafraîchit les prix des UC', async () => {
    const { db, userId, accountId, supportId } = setupDb();
    db.prepare(
      `INSERT INTO insurance_positions (user_id, account_id, support_id, quantity, avg_price, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ).run(userId, accountId, supportId, 5, 1500);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            chart: { result: [{ meta: { regularMarketPrice: 15, currency: 'EUR' } }] },
          }),
      }),
    );

    await refreshInsurancePrices(db, accountId);
    expect(fetch).toHaveBeenCalled();
  });

  it('ne plante pas si le fetch échoue pour un ticker', async () => {
    const { db, accountId } = setupDb();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    await expect(refreshInsurancePrices(db, accountId)).resolves.toBeUndefined();
  });

  it('journalise un warning si refreshPrice retourne null (réponse non-ok)', async () => {
    const { db, userId, accountId, supportId } = setupDb();
    db.prepare(
      `INSERT INTO insurance_positions (user_id, account_id, support_id, quantity, avg_price, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ).run(userId, accountId, supportId, 5, 1500);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(refreshInsurancePrices(db, accountId)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalled();
  });

  it('ne fait rien si le compte na pas de UC', async () => {
    const db = createTestDb();
    const userId = Number(
      db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('u2', 'x')
        .lastInsertRowid,
    );
    seedTestReferenceData(db, userId);
    const emptyAccountId = Number(
      db
        .prepare(
          'INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(userId, 'Vide', 1, 1, 0, '2024-01-01').lastInsertRowid,
    );
    vi.stubGlobal('fetch', vi.fn());

    await refreshInsurancePrices(db, emptyAccountId);
    expect(fetch).not.toHaveBeenCalled();
  });
});
