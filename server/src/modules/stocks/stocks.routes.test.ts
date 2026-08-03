import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

const MOCK_FETCH_PRICE = { price: 15.5, currency: 'EUR' };

function mockFetchSuccess() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => ({
      chart: { result: [{ meta: { regularMarketPrice: 15.5, currency: 'EUR' } }] },
    }),
  } as unknown as Response);
}

function mockFetchFailure() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as unknown as Response);
}

describe('/api/stocks', () => {
  let ctx: TestContext;
  let bourseAccountId: number;
  let standardAccountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();

    const bourse = await ctx.agent.post('/api/accounts').send({
      name: 'PEA Test',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_BOURSE,
      initial_balance: 5000,
      opening_date: '2024-01-01',
    });
    bourseAccountId = bourse.body.id;

    const courant = await ctx.agent.post('/api/accounts').send({
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 1000,
      opening_date: '2024-01-01',
    });
    standardAccountId = courant.body.id;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Positions ────────────────────────────────────────────────────────────

  describe('GET /:accountId/positions', () => {
    it('retourne un tableau vide pour un nouveau compte', async () => {
      const res = await ctx.agent.get(`/api/stocks/${bourseAccountId}/positions`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('retourne 403 pour un compte inconnu', async () => {
      const res = await ctx.agent.get('/api/stocks/99999/positions');
      expect(res.status).toBe(403);
    });
  });

  // ─── Opérations ───────────────────────────────────────────────────────────

  describe('GET /:accountId/operations', () => {
    it('retourne un tableau vide initialement', async () => {
      const res = await ctx.agent.get(`/api/stocks/${bourseAccountId}/operations`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── Buy ──────────────────────────────────────────────────────────────────

  describe('POST /:accountId/buy', () => {
    it('crée une opération achat et une transaction dépense', async () => {
      const res = await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'DCAM.PA',
        quantity: 10,
        price_per_share: 12,
        fees: 1.5,
        date: TODAY,
      });
      expect(res.status).toBe(201);
      expect(res.body.operation.type).toBe('buy');
      expect(res.body.operation.ticker).toBe('DCAM.PA');
      expect(res.body.operation.quantity).toBe(10);
      expect(res.body.operation.fees).toBe(1.5);
      expect(res.body.transaction_id).toBeGreaterThan(0);

      // Tx principale : montant brut sans frais (10 * 12 = 120)
      const txRes = await ctx.agent.get('/api/transactions');
      const tx = txRes.body.data.find((t: { id: number }) => t.id === res.body.transaction_id);
      expect(tx.type).toBe('expense');
      expect(tx.amount).toBe(120);
      // Tx de frais séparée (1.5 €)
      const feesTx = txRes.body.data.find(
        (t: { id: number }) => t.id === res.body.operation.fees_transaction_id,
      );
      expect(feesTx).toBeDefined();
      expect(feesTx.type).toBe('expense');
      expect(feesTx.amount).toBe(1.5);
    });

    it('met à jour la position après achat', async () => {
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'AIR.PA',
        quantity: 5,
        price_per_share: 150,
        fees: 2,
        date: TODAY,
      });

      const posRes = await ctx.agent.get(`/api/stocks/${bourseAccountId}/positions`);
      const pos = posRes.body.find((p: { ticker: string }) => p.ticker === 'AIR.PA');
      expect(pos).toBeDefined();
      expect(pos.quantity).toBe(5);
      expect(pos.avg_price).toBe(150);
    });

    it('calcule correctement le PRU lors de deux achats successifs', async () => {
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'MC.PA',
        quantity: 10,
        price_per_share: 600,
        fees: 0,
        date: TODAY,
      });
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'MC.PA',
        quantity: 10,
        price_per_share: 700,
        fees: 0,
        date: TODAY,
      });

      const posRes = await ctx.agent.get(`/api/stocks/${bourseAccountId}/positions`);
      const pos = posRes.body.find((p: { ticker: string }) => p.ticker === 'MC.PA');
      expect(pos.quantity).toBe(20);
      expect(pos.avg_price).toBe(650); // (10*600 + 10*700) / 20
    });

    it('retourne 400 pour un compte non investissement', async () => {
      const res = await ctx.agent.post(`/api/stocks/${standardAccountId}/buy`).send({
        ticker: 'AAPL',
        quantity: 1,
        price_per_share: 200,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });

    it('retourne 403 pour un compte inconnu', async () => {
      const res = await ctx.agent.post('/api/stocks/99999/buy').send({
        ticker: 'AAPL',
        quantity: 1,
        price_per_share: 200,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(403);
    });

    it('retourne 400 sur paramètres invalides', async () => {
      const res = await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: '',
        quantity: -1,
        price_per_share: 100,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Sell ─────────────────────────────────────────────────────────────────

  describe('POST /:accountId/sell', () => {
    it('crée une opération vente et une transaction revenu', async () => {
      // D'abord acheter
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'OR.PA',
        quantity: 8,
        price_per_share: 200,
        fees: 1,
        date: TODAY,
      });

      const res = await ctx.agent.post(`/api/stocks/${bourseAccountId}/sell`).send({
        ticker: 'OR.PA',
        quantity: 3,
        price_per_share: 220,
        fees: 1,
        date: TODAY,
      });
      expect(res.status).toBe(201);
      expect(res.body.operation.type).toBe('sell');
      expect(res.body.operation.quantity).toBe(3);

      // Tx principale : montant brut (3 * 220 = 660), frais séparés
      const txRes = await ctx.agent.get('/api/transactions');
      const tx = txRes.body.data.find((t: { id: number }) => t.id === res.body.transaction_id);
      expect(tx.type).toBe('income');
      expect(tx.amount).toBe(660);
      // Tx de frais séparée (1 €)
      const feesTx = txRes.body.data.find(
        (t: { id: number }) => t.id === res.body.operation.fees_transaction_id,
      );
      expect(feesTx).toBeDefined();
      expect(feesTx.type).toBe('expense');
      expect(feesTx.amount).toBe(1);
    });

    it('met à jour la quantité restante après vente partielle', async () => {
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'FP.PA',
        quantity: 10,
        price_per_share: 50,
        fees: 0,
        date: TODAY,
      });
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/sell`).send({
        ticker: 'FP.PA',
        quantity: 4,
        price_per_share: 55,
        fees: 0,
        date: TODAY,
      });

      const posRes = await ctx.agent.get(`/api/stocks/${bourseAccountId}/positions`);
      const pos = posRes.body.find((p: { ticker: string }) => p.ticker === 'FP.PA');
      expect(pos.quantity).toBe(6);
    });

    it('supprime la position quand toutes les actions sont vendues', async () => {
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'BNP.PA',
        quantity: 5,
        price_per_share: 60,
        fees: 0,
        date: TODAY,
      });
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/sell`).send({
        ticker: 'BNP.PA',
        quantity: 5,
        price_per_share: 65,
        fees: 0,
        date: TODAY,
      });

      const posRes = await ctx.agent.get(`/api/stocks/${bourseAccountId}/positions`);
      const pos = posRes.body.find((p: { ticker: string }) => p.ticker === 'BNP.PA');
      expect(pos).toBeUndefined();
    });

    it('retourne 400 si position insuffisante', async () => {
      const res = await ctx.agent.post(`/api/stocks/${bourseAccountId}/sell`).send({
        ticker: 'NONEXISTENT',
        quantity: 1,
        price_per_share: 100,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Transfer ─────────────────────────────────────────────────────────────

  describe('POST /:accountId/transfer', () => {
    let bourseAccountId2: number;

    beforeAll(async () => {
      const bourse2 = await ctx.agent.post('/api/accounts').send({
        name: 'CTO Test',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_BOURSE,
        initial_balance: 3000,
        opening_date: '2024-01-01',
      });
      bourseAccountId2 = bourse2.body.id;
    });

    it('crée deux opérations et deux transactions transfer liées', async () => {
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'TRF.PA',
        quantity: 10,
        price_per_share: 50,
        fees: 0,
        date: TODAY,
      });

      const res = await ctx.agent.post(`/api/stocks/${bourseAccountId}/transfer`).send({
        to_account_id: bourseAccountId2,
        ticker: 'TRF.PA',
        quantity: 4,
        date: TODAY,
      });

      expect(res.status).toBe(201);
      expect(res.body.outOperation.type).toBe('transfer_out');
      expect(res.body.outOperation.ticker).toBe('TRF.PA');
      expect(res.body.outOperation.quantity).toBe(4);
      expect(res.body.inOperation.type).toBe('transfer_in');
      expect(res.body.inOperation.quantity).toBe(4);
      expect(res.body.outOperation.transaction_id).toBeGreaterThan(0);
      expect(res.body.inOperation.transaction_id).toBeGreaterThan(0);

      const txRes = await ctx.agent.get('/api/transactions');
      const expenseTx = txRes.body.data.find(
        (t: { id: number }) => t.id === res.body.outOperation.transaction_id,
      );
      const incomeTx = txRes.body.data.find(
        (t: { id: number }) => t.id === res.body.inOperation.transaction_id,
      );

      expect(expenseTx).toBeDefined();
      expect(expenseTx.type).toBe('expense');
      expect(expenseTx.description).toBe('Transfert 4 × TRF.PA');
      expect(expenseTx.amount).toBe(200); // 4 * 50 €

      expect(incomeTx).toBeDefined();
      expect(incomeTx.type).toBe('income');
      expect(incomeTx.description).toBe('Transfert 4 × TRF.PA');
      expect(incomeTx.amount).toBe(200);

      expect(expenseTx.transfer_peer_id).toBe(incomeTx.id);
      expect(incomeTx.transfer_peer_id).toBe(expenseTx.id);
    });

    it('met à jour les positions des deux comptes en conservant le PRU', async () => {
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'TRF2.PA',
        quantity: 10,
        price_per_share: 100,
        fees: 0,
        date: TODAY,
      });

      await ctx.agent.post(`/api/stocks/${bourseAccountId}/transfer`).send({
        to_account_id: bourseAccountId2,
        ticker: 'TRF2.PA',
        quantity: 3,
        date: TODAY,
      });

      const fromPos = await ctx.agent.get(`/api/stocks/${bourseAccountId}/positions`);
      const toPos = await ctx.agent.get(`/api/stocks/${bourseAccountId2}/positions`);

      const fromTicker = fromPos.body.find((p: { ticker: string }) => p.ticker === 'TRF2.PA');
      const toTicker = toPos.body.find((p: { ticker: string }) => p.ticker === 'TRF2.PA');

      expect(fromTicker.quantity).toBe(7);
      expect(toTicker.quantity).toBe(3);
      expect(toTicker.avg_price).toBe(100);
    });

    it('recalcule les positions des deux comptes après suppression du transfert', async () => {
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'DELTRF.PA',
        quantity: 10,
        price_per_share: 100,
        fees: 0,
        date: TODAY,
      });

      const transferRes = await ctx.agent.post(`/api/stocks/${bourseAccountId}/transfer`).send({
        to_account_id: bourseAccountId2,
        ticker: 'DELTRF.PA',
        quantity: 4,
        date: TODAY,
      });
      expect(transferRes.status).toBe(201);

      // État après transfert : source 6, destination 4
      const fromMid = await ctx.agent.get(`/api/stocks/${bourseAccountId}/positions`);
      const toMid = await ctx.agent.get(`/api/stocks/${bourseAccountId2}/positions`);
      expect(fromMid.body.find((p: { ticker: string }) => p.ticker === 'DELTRF.PA').quantity).toBe(
        6,
      );
      expect(toMid.body.find((p: { ticker: string }) => p.ticker === 'DELTRF.PA').quantity).toBe(4);

      // Suppression via le endpoint transfert (la cascade efface les stock_operations)
      const delRes = await ctx.agent.delete(
        `/api/transfers/${transferRes.body.outOperation.transaction_id}`,
      );
      expect(delRes.status).toBe(200);

      // Positions recalculées : source revient à 10, destination n'a plus le titre
      const fromAfter = await ctx.agent.get(`/api/stocks/${bourseAccountId}/positions`);
      const toAfter = await ctx.agent.get(`/api/stocks/${bourseAccountId2}/positions`);
      expect(
        fromAfter.body.find((p: { ticker: string }) => p.ticker === 'DELTRF.PA').quantity,
      ).toBe(10);
      expect(
        toAfter.body.find((p: { ticker: string }) => p.ticker === 'DELTRF.PA'),
      ).toBeUndefined();
    });

    it('retourne 400 si position insuffisante', async () => {
      const res = await ctx.agent.post(`/api/stocks/${bourseAccountId}/transfer`).send({
        to_account_id: bourseAccountId2,
        ticker: 'GHOST.PA',
        quantity: 1,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });

    it("retourne 400 si le compte destination n'est pas un compte investissement", async () => {
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'STD.PA',
        quantity: 5,
        price_per_share: 10,
        fees: 0,
        date: TODAY,
      });

      const res = await ctx.agent.post(`/api/stocks/${bourseAccountId}/transfer`).send({
        to_account_id: standardAccountId,
        ticker: 'STD.PA',
        quantity: 1,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });

    it('retourne 400 si source et destination sont identiques', async () => {
      const res = await ctx.agent.post(`/api/stocks/${bourseAccountId}/transfer`).send({
        to_account_id: bourseAccountId,
        ticker: 'TRF.PA',
        quantity: 1,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });

    it('retourne 403 pour un compte source inconnu', async () => {
      const res = await ctx.agent.post('/api/stocks/99999/transfer').send({
        to_account_id: bourseAccountId2,
        ticker: 'TRF.PA',
        quantity: 1,
        date: TODAY,
      });
      expect(res.status).toBe(403);
    });
  });

  // ─── Édition d'opération ──────────────────────────────────────────────────

  describe('PUT /:accountId/operations/:operationId', () => {
    it('met à jour la quantité et recalcule le PRU', async () => {
      // Acheter 10 à 12 → position: qty=10, avg=12
      const buyRes = await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'EDIT.PA',
        quantity: 10,
        price_per_share: 12,
        fees: 0,
        date: TODAY,
      });
      const opId = buyRes.body.operation.id;

      // Modifier : 20 actions à 14
      const res = await ctx.agent
        .put(`/api/stocks/${bourseAccountId}/operations/${opId}`)
        .send({ quantity: 20, price_per_share: 14, fees: 0, date: TODAY });

      expect(res.status).toBe(200);
      expect(res.body.quantity).toBe(20);
      expect(res.body.price_per_share).toBe(14);

      // La position doit refléter la nouvelle quantité
      const posRes = await ctx.agent.get(`/api/stocks/${bourseAccountId}/positions`);
      const pos = posRes.body.find((p: { ticker: string }) => p.ticker === 'EDIT.PA');
      expect(pos.quantity).toBe(20);
      expect(pos.avg_price).toBe(14);

      // La transaction doit avoir le nouveau montant (20 * 14 = 280)
      const txRes = await ctx.agent.get('/api/transactions');
      const tx = txRes.body.data.find((t: { id: number }) => t.id === buyRes.body.transaction_id);
      expect(tx.amount).toBe(280);
    });

    it('met à jour les frais et recalcule le montant', async () => {
      const buyRes = await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'FEES.PA',
        quantity: 5,
        price_per_share: 100,
        fees: 0,
        date: TODAY,
      });
      const opId = buyRes.body.operation.id;

      const res = await ctx.agent
        .put(`/api/stocks/${bourseAccountId}/operations/${opId}`)
        .send({ quantity: 5, price_per_share: 100, fees: 2.5, date: TODAY });

      expect(res.status).toBe(200);
      expect(res.body.fees).toBe(2.5);

      const txRes = await ctx.agent.get('/api/transactions');
      const tx = txRes.body.data.find((t: { id: number }) => t.id === buyRes.body.transaction_id);
      // Tx principale : montant brut sans frais (5 * 100 = 500)
      expect(tx.amount).toBe(500);
      // Tx de frais créée lors de la mise à jour (2.5 €)
      const feesTx = txRes.body.data.find(
        (t: { id: number }) => t.id === res.body.fees_transaction_id,
      );
      expect(feesTx).toBeDefined();
      expect(feesTx.amount).toBe(2.5);
    });

    it('retourne 404 pour une opération inconnue', async () => {
      const res = await ctx.agent
        .put(`/api/stocks/${bourseAccountId}/operations/99999`)
        .send({ quantity: 1, price_per_share: 10, fees: 0, date: TODAY });
      expect(res.status).toBe(404);
    });

    it('retourne 403 pour un compte inconnu', async () => {
      const res = await ctx.agent
        .put(`/api/stocks/99999/operations/1`)
        .send({ quantity: 1, price_per_share: 10, fees: 0, date: TODAY });
      expect(res.status).toBe(403);
    });

    it('retourne 400 sur paramètres invalides', async () => {
      const res = await ctx.agent
        .put(`/api/stocks/${bourseAccountId}/operations/1`)
        .send({ quantity: -1, price_per_share: 0, date: TODAY });
      expect(res.status).toBe(400);
    });
  });

  // ─── Prix ─────────────────────────────────────────────────────────────────

  describe('GET /price/:ticker', () => {
    it('retourne le prix en cache ou fetché', async () => {
      mockFetchSuccess();
      const res = await ctx.agent.get('/api/stocks/price/AAPL');
      expect(res.status).toBe(200);
      expect(res.body.price).toBe(MOCK_FETCH_PRICE.price);
      expect(res.body.currency).toBe('EUR');
    });

    it('retourne 404 si Yahoo Finance échoue', async () => {
      mockFetchFailure();
      const res = await ctx.agent.get('/api/stocks/price/INVALID_TICKER_XYZ');
      expect(res.status).toBe(404);
    });
  });

  // ─── Refresh ──────────────────────────────────────────────────────────────

  describe('POST /prices/refresh', () => {
    it('retourne ok: true', async () => {
      mockFetchSuccess();
      const res = await ctx.agent.post('/api/stocks/prices/refresh');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ─── Tickers en cache ──────────────────────────────────────────────────────

  describe('GET /tickers + DELETE /tickers/:ticker', () => {
    const seedPrice = (ticker: string, price = 10) =>
      ctx.db
        .prepare(
          "INSERT OR REPLACE INTO stock_prices (ticker, price, currency, fetched_at, name) VALUES (?, ?, 'EUR', datetime('now'), ?)",
        )
        .run(ticker, price, null);

    it('liste les tickers en cache avec leur statut in_use', async () => {
      seedPrice('CACHEA.PA');
      const res = await ctx.agent.get('/api/stocks/tickers');
      expect(res.status).toBe(200);
      const row = res.body.find((t: { ticker: string }) => t.ticker === 'CACHEA.PA');
      expect(row).toBeDefined();
      expect(row.price).toBe(10);
      expect(row.in_use).toBe(false);
      expect(row.held_in).toEqual([]);
      expect(row.used_by_others).toBe(false);
      expect(row.has_price_history).toBe(false);
    });

    it('marque in_use un ticker encore détenu et renseigne held_in', async () => {
      seedPrice('AIR.PA');
      await ctx.agent.post(`/api/stocks/${bourseAccountId}/buy`).send({
        ticker: 'AIR.PA',
        quantity: 5,
        price_per_share: 150,
        fees: 0,
        date: TODAY,
      });
      const res = await ctx.agent.get('/api/stocks/tickers');
      const row = res.body.find((t: { ticker: string }) => t.ticker === 'AIR.PA');
      expect(row).toBeDefined();
      expect(row.in_use).toBe(true);
      expect(row.held_in).toContain('PEA Test');
      expect(row.used_by_others).toBe(false);
      expect(row.has_price_history).toBe(false);
    });

    it('marque used_by_others quand un autre utilisateur détient le ticker', async () => {
      seedPrice('SHARED.PA');
      ctx.db
        .prepare(
          `INSERT INTO users (username, password_hash)
           SELECT 'other_user', 'x' WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'other_user')`,
        )
        .run();
      const otherUserId = (
        ctx.db.prepare('SELECT id FROM users WHERE username = ?').get('other_user') as {
          id: number;
        }
      ).id;
      const otherAcc = ctx.db
        .prepare(
          `INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance)
           VALUES (?, 'Compte Autre', ?, (SELECT id FROM account_types WHERE name = 'Bourse' LIMIT 1), 0)`,
        )
        .run(otherUserId, SEED.BANK_ID);
      const otherAccountId = Number(otherAcc.lastInsertRowid);
      ctx.db
        .prepare(
          `INSERT INTO stock_positions (user_id, account_id, ticker, quantity)
           VALUES (?, ?, 'SHARED.PA', 3)`,
        )
        .run(otherUserId, otherAccountId);

      const res = await ctx.agent.get('/api/stocks/tickers');
      const row = res.body.find((t: { ticker: string }) => t.ticker === 'SHARED.PA');
      expect(row).toBeDefined();
      expect(row.in_use).toBe(true);
      expect(row.held_in).toEqual([]);
      expect(row.used_by_others).toBe(true);
      expect(row.has_price_history).toBe(false);
    });

    it('supprime un ticker inutilisé du cache', async () => {
      seedPrice('ORPHAN.PA');
      const res = await ctx.agent.delete('/api/stocks/tickers/ORPHAN.PA');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const list = await ctx.agent.get('/api/stocks/tickers');
      expect(list.body.find((t: { ticker: string }) => t.ticker === 'ORPHAN.PA')).toBeUndefined();
    });

    it('refuse la suppression d’un ticker encore détenu (409)', async () => {
      seedPrice('AIR.PA');
      const res = await ctx.agent.delete('/api/stocks/tickers/AIR.PA');
      expect(res.status).toBe(409);
    });

    it('refuse la suppression d’un ticker avec historique de prix (409)', async () => {
      ctx.db
        .prepare(
          "INSERT OR REPLACE INTO stock_price_history (ticker, date, price, currency) VALUES ('HIST.PA', '2024-12-31', 10, 'EUR')",
        )
        .run();
      seedPrice('HIST.PA');
      const res = await ctx.agent.delete('/api/stocks/tickers/HIST.PA');
      expect(res.status).toBe(409);
    });

    it('retourne 404 pour un ticker absent du cache', async () => {
      const res = await ctx.agent.delete('/api/stocks/tickers/NOPE.PA');
      expect(res.status).toBe(404);
    });

    it('renomme un ticker et le répercute partout', async () => {
      seedPrice('RENAMED.PA');
      ctx.db
        .prepare(
          "INSERT OR REPLACE INTO stock_price_history (ticker, date, price, currency) VALUES ('RENAMED.PA', '2024-12-31', 10, 'EUR')",
        )
        .run();
      ctx.db
        .prepare(
          "INSERT INTO stock_positions (user_id, account_id, ticker, quantity) VALUES (?, ?, 'RENAMED.PA', 2)",
        )
        .run(ctx.userId, bourseAccountId);

      const res = await ctx.agent
        .put('/api/stocks/tickers/RENAMED.PA')
        .send({ new_ticker: 'REN2.PA' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const price = ctx.db
        .prepare('SELECT ticker FROM stock_prices WHERE ticker = ?')
        .get('REN2.PA') as { ticker: string } | undefined;
      expect(price?.ticker).toBe('REN2.PA');
      const pos = ctx.db
        .prepare('SELECT ticker FROM stock_positions WHERE ticker = ?')
        .get('REN2.PA') as { ticker: string } | undefined;
      expect(pos?.ticker).toBe('REN2.PA');
      const hist = ctx.db
        .prepare("SELECT ticker FROM stock_price_history WHERE ticker = 'REN2.PA'")
        .get() as { ticker: string } | undefined;
      expect(hist?.ticker).toBe('REN2.PA');
      expect(
        ctx.db.prepare("SELECT COUNT(*) AS c FROM stock_prices WHERE ticker = 'RENAMED.PA'").get(),
      ).toEqual({ c: 0 });
    });

    it('refuse le rename vers un ticker déjà en cache (409)', async () => {
      seedPrice('A.PA');
      seedPrice('B.PA');
      const res = await ctx.agent.put('/api/stocks/tickers/A.PA').send({ new_ticker: 'B.PA' });
      expect(res.status).toBe(409);
    });

    it('retourne 404 pour un rename de ticker absent du cache', async () => {
      const res = await ctx.agent.put('/api/stocks/tickers/NOPE.PA').send({ new_ticker: 'NEW.PA' });
      expect(res.status).toBe(404);
    });

    it('refuse le rename vers un ticker identique (400)', async () => {
      seedPrice('C.PA');
      const res = await ctx.agent.put('/api/stocks/tickers/C.PA').send({ new_ticker: 'C.PA' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Intégration balance_stocks ───────────────────────────────────────────

  describe('balance_stocks dans /api/accounts', () => {
    it('inclut la valorisation des actions dans balance_stocks', async () => {
      // Injecter un prix connu en base
      ctx.db
        .prepare(
          "INSERT OR REPLACE INTO stock_prices (ticker, price, currency, fetched_at) VALUES (?, ?, ?, datetime('now'))",
        )
        .run('DCAM.PA', 20, 'EUR');

      const res = await ctx.agent.get('/api/accounts');
      const account = res.body.find((a: { id: number }) => a.id === bourseAccountId);
      expect(account).toBeDefined();
      expect(typeof account.balance_stocks).toBe('number');
      expect(account.envelope_type).toBe('investment');
    });
  });
});
