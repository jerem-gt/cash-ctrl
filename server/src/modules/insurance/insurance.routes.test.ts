import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

describe('/api/insurance', () => {
  let ctx: TestContext;
  let avAccountId: number;
  let standardAccountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();

    const av = await ctx.agent.post('/api/accounts').send({
      name: 'AV Suravenir',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_AV,
      initial_balance: 0,
      opening_date: '2024-01-01',
    });
    avAccountId = av.body.id;

    const courant = await ctx.agent.post('/api/accounts').send({
      name: 'Courant',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 1000,
      opening_date: '2024-01-01',
    });
    standardAccountId = courant.body.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── Supports ─────────────────────────────────────────────────────────────

  describe('POST /:accountId/supports', () => {
    it('crée un fonds euro', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Fonds Euro Avenir',
        type: 'euro',
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Fonds Euro Avenir');
      expect(res.body.type).toBe('euro');
    });

    it('crée une UC avec ticker', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Amundi MSCI World',
        type: 'uc',
        ticker: 'LU1681043599.SW',
      });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('uc');
      expect(res.body.ticker).toBe('LU1681043599.SW');
    });

    it('retourne 400 pour un compte non-assurance', async () => {
      const res = await ctx.agent.post(`/api/insurance/${standardAccountId}/supports`).send({
        name: 'Test',
        type: 'euro',
      });
      expect(res.status).toBe(400);
    });

    it('retourne 403 pour un compte inconnu', async () => {
      const res = await ctx.agent.post('/api/insurance/99999/supports').send({
        name: 'Test',
        type: 'euro',
      });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /:accountId/supports', () => {
    it('retourne les supports du compte', async () => {
      const res = await ctx.agent.get(`/api/insurance/${avAccountId}/supports`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ─── Versement fonds euro ─────────────────────────────────────────────────

  describe('POST /:accountId/versement (fonds euro)', () => {
    let euroSupportId: number;

    beforeAll(async () => {
      const sup = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Fonds Euro Test Versement',
        type: 'euro',
      });
      euroSupportId = sup.body.id;
    });

    it('crée un versement et une transaction expense', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: euroSupportId,
        amount: 1000,
        fees: 0,
        date: TODAY,
        source_account_id: standardAccountId,
      });
      expect(res.status).toBe(201);
      expect(res.body.operation.type).toBe('versement');
      expect(res.body.operation.amount).toBe(1000);
      expect(res.body.transaction_id).toBeGreaterThan(0);

      const txRes = await ctx.agent.get('/api/transactions');
      const tx = txRes.body.data.find((t: { id: number }) => t.id === res.body.transaction_id);
      expect(tx.type).toBe('expense');
      expect(tx.amount).toBe(1000);
    });

    it('crée une transaction de frais séparée si frais > 0', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: euroSupportId,
        amount: 500,
        fees: 2.5,
        date: TODAY,
        source_account_id: standardAccountId,
      });
      expect(res.status).toBe(201);
      expect(res.body.operation.fees).toBe(2.5);
      expect(res.body.operation.fees_transaction_id).toBeGreaterThan(0);
    });

    it('met à jour la valeur fonds euro', async () => {
      const posRes = await ctx.agent.get(`/api/insurance/${avAccountId}/positions`);
      const pos = posRes.body.find((p: { id: number }) => p.id === euroSupportId);
      expect(pos).toBeDefined();
      expect(pos.value).toBeGreaterThan(0);
    });
  });

  // ─── Versement UC ─────────────────────────────────────────────────────────

  describe('POST /:accountId/versement (UC)', () => {
    let ucSupportId: number;

    beforeAll(async () => {
      const sup = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'UC Test Versement',
        type: 'uc',
      });
      ucSupportId = sup.body.id;
    });

    it('crée un versement UC et retourne le montant', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: ucSupportId,
        amount: 1000,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(201);
      expect(res.body.operation.type).toBe('versement');
      expect(res.body.operation.amount).toBe(1000);
    });

    it('accumule la valeur sur deux versements', async () => {
      const sup = (
        await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
          name: 'UC Valeur Test',
          type: 'uc',
        })
      ).body;

      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: sup.id,
        amount: 1000,
        fees: 0,
        date: TODAY,
      });
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: sup.id,
        amount: 1000,
        fees: 0,
        date: TODAY,
      });

      const posRes = await ctx.agent.get(`/api/insurance/${avAccountId}/positions`);
      const pos = posRes.body.find((p: { id: number }) => p.id === sup.id);
      expect(pos.value).toBeCloseTo(2000);
    });
  });

  // ─── Rachat ───────────────────────────────────────────────────────────────

  describe('POST /:accountId/rachat', () => {
    let euroSupportId: number;
    let ucSupportId: number;

    beforeAll(async () => {
      const e = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Fonds Euro Rachat',
        type: 'euro',
      });
      euroSupportId = e.body.id;
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: euroSupportId,
        amount: 5000,
        fees: 0,
        date: TODAY,
      });

      const u = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'UC Rachat',
        type: 'uc',
      });
      ucSupportId = u.body.id;
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: ucSupportId,
        amount: 2000,
        fees: 0,
        date: TODAY,
      });
    });

    it('crée un rachat fonds euro et une transaction income', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/rachat`).send({
        support_id: euroSupportId,
        amount: 1000,
        fees: 0,
        date: TODAY,
        dest_account_id: standardAccountId,
      });
      expect(res.status).toBe(201);
      expect(res.body.operation.type).toBe('rachat');
      expect(res.body.transaction_id).toBeGreaterThan(0);

      const txRes = await ctx.agent.get('/api/transactions');
      const tx = txRes.body.data.find((t: { id: number }) => t.id === res.body.transaction_id);
      expect(tx.type).toBe('income');
      expect(tx.amount).toBe(1000);
    });

    it('retourne 400 si solde euro insuffisant', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/rachat`).send({
        support_id: euroSupportId,
        amount: 99999,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });

    it('crée un rachat UC et met à jour la valeur', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/rachat`).send({
        support_id: ucSupportId,
        amount: 500,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(201);

      const posRes = await ctx.agent.get(`/api/insurance/${avAccountId}/positions`);
      const pos = posRes.body.find((p: { id: number }) => p.id === ucSupportId);
      expect(pos.value).toBeCloseTo(1500);
    });

    it('retourne 400 si solde UC insuffisant', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/rachat`).send({
        support_id: ucSupportId,
        amount: 99999,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Arbitrage ────────────────────────────────────────────────────────────

  describe('POST /:accountId/arbitrage', () => {
    let euroSupportId: number;
    let ucSupportId: number;

    beforeAll(async () => {
      const e = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Euro Arbitrage',
        type: 'euro',
      });
      euroSupportId = e.body.id;
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: euroSupportId,
        amount: 3000,
        fees: 0,
        date: TODAY,
      });

      const u = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'UC Arbitrage',
        type: 'uc',
      });
      ucSupportId = u.body.id;
    });

    it('crée un arbitrage fonds euro → UC sans transaction principale', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/arbitrage`).send({
        from_support_id: euroSupportId,
        to_support_id: ucSupportId,
        from_amount: 1000,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(201);
      expect(res.body.outOperation.type).toBe('arbitrage_out');
      expect(res.body.inOperation.type).toBe('arbitrage_in');
      expect(res.body.outOperation.transaction_id).toBeNull();
      expect(res.body.inOperation.transaction_id).toBeNull();

      const posRes = await ctx.agent.get(`/api/insurance/${avAccountId}/positions`);
      const ucPos = posRes.body.find((p: { id: number }) => p.id === ucSupportId);
      expect(ucPos.value).toBeCloseTo(1000);

      const euroPos = posRes.body.find((p: { id: number }) => p.id === euroSupportId);
      expect(euroPos.value).toBeCloseTo(2000);
    });

    it('retourne 400 si supports identiques', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/arbitrage`).send({
        from_support_id: euroSupportId,
        to_support_id: euroSupportId,
        from_amount: 100,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });

    it('retourne 400 si solde insuffisant', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/arbitrage`).send({
        from_support_id: euroSupportId,
        to_support_id: ucSupportId,
        from_amount: 99999,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });

    it('crée une transaction de frais si frais > 0', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/arbitrage`).send({
        from_support_id: euroSupportId,
        to_support_id: ucSupportId,
        from_amount: 500,
        fees: 5,
        date: TODAY,
      });
      expect(res.status).toBe(201);
      expect(res.body.outOperation.fees).toBe(5);
      expect(res.body.outOperation.fees_transaction_id).toBeGreaterThan(0);
    });
  });

  // ─── Intérêts ─────────────────────────────────────────────────────────────

  describe('POST /:accountId/interets', () => {
    let euroSupportId: number;
    let ucSupportId: number;

    beforeAll(async () => {
      const e = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Euro Intérêts',
        type: 'euro',
      });
      euroSupportId = e.body.id;
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: euroSupportId,
        amount: 10000,
        fees: 0,
        date: TODAY,
      });

      const u = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'UC Intérêts',
        type: 'uc',
      });
      ucSupportId = u.body.id;
    });

    it('crée une opération intérêts et une transaction income', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/interets`).send({
        support_id: euroSupportId,
        amount: 150,
        date: TODAY,
      });
      expect(res.status).toBe(201);
      expect(res.body.operation.type).toBe('interets');
      expect(res.body.operation.amount).toBe(150);

      const txRes = await ctx.agent.get('/api/transactions');
      const tx = txRes.body.data.find((t: { id: number }) => t.id === res.body.transaction_id);
      expect(tx.type).toBe('income');
      expect(tx.amount).toBe(150);

      const posRes = await ctx.agent.get(`/api/insurance/${avAccountId}/positions`);
      const pos = posRes.body.find((p: { id: number }) => p.id === euroSupportId);
      expect(pos.value).toBeCloseTo(10150);
    });

    it('retourne 400 si le support est une UC', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/interets`).send({
        support_id: ucSupportId,
        amount: 100,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Revalorisation ───────────────────────────────────────────────────────

  describe('POST /:accountId/revalorisation', () => {
    let ucSupportId: number;
    let euroSupportId: number;

    beforeAll(async () => {
      const u = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'UC Revalorisation',
        type: 'uc',
      });
      ucSupportId = u.body.id;
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: ucSupportId,
        amount: 3000,
        fees: 0,
        date: TODAY,
      });

      const e = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Euro Revalorisation',
        type: 'euro',
      });
      euroSupportId = e.body.id;
    });

    it('enregistre une plus-value et met à jour la valeur', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/revalorisation`).send({
        support_id: ucSupportId,
        amount: 200,
        date: TODAY,
      });
      expect(res.status).toBe(201);
      expect(res.body.operation.type).toBe('revalorisation');
      expect(res.body.operation.amount).toBeCloseTo(200);

      const posRes = await ctx.agent.get(`/api/insurance/${avAccountId}/positions`);
      const pos = posRes.body.find((p: { id: number }) => p.id === ucSupportId);
      expect(pos.value).toBeCloseTo(3200);
    });

    it('enregistre une moins-value (montant négatif)', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/revalorisation`).send({
        support_id: ucSupportId,
        amount: -150,
        date: TODAY,
      });
      expect(res.status).toBe(201);
      expect(res.body.operation.amount).toBeCloseTo(-150);

      const posRes = await ctx.agent.get(`/api/insurance/${avAccountId}/positions`);
      const pos = posRes.body.find((p: { id: number }) => p.id === ucSupportId);
      expect(pos.value).toBeCloseTo(3050);
    });

    it('retourne 400 si le support est un fonds euro', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/revalorisation`).send({
        support_id: euroSupportId,
        amount: 100,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });

    it('retourne 404 pour un support inconnu', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/revalorisation`).send({
        support_id: 99999,
        amount: 100,
        date: TODAY,
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Positions & opérations ───────────────────────────────────────────────

  describe('GET /:accountId/positions', () => {
    it('retourne un tableau avec les supports', async () => {
      const res = await ctx.agent.get(`/api/insurance/${avAccountId}/positions`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('retourne 403 pour un compte inconnu', async () => {
      const res = await ctx.agent.get('/api/insurance/99999/positions');
      expect(res.status).toBe(403);
    });
  });

  describe('GET /:accountId/operations', () => {
    it('retourne les opérations triées par date', async () => {
      const res = await ctx.agent.get(`/api/insurance/${avAccountId}/operations`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ─── Suppression support ──────────────────────────────────────────────────

  describe('DELETE /:accountId/supports/:supportId', () => {
    it('supprime un support vide (valeur = 0)', async () => {
      const sup = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Support à supprimer',
        type: 'euro',
      });
      const res = await ctx.agent.delete(`/api/insurance/${avAccountId}/supports/${sup.body.id}`);
      expect(res.status).toBe(200);
    });

    it('retourne 400 si solde non nul', async () => {
      const sup = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Euro non vide',
        type: 'euro',
      });
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: sup.body.id,
        amount: 100,
        fees: 0,
        date: TODAY,
      });
      const res = await ctx.agent.delete(`/api/insurance/${avAccountId}/supports/${sup.body.id}`);
      expect(res.status).toBe(400);
    });

    it('supprime une UC sans versement', async () => {
      const sup = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'UC vide',
        type: 'uc',
      });
      const res = await ctx.agent.delete(`/api/insurance/${avAccountId}/supports/${sup.body.id}`);
      expect(res.status).toBe(200);
    });

    it('retourne 400 pour une UC avec un solde positif', async () => {
      const sup = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'UC avec solde',
        type: 'uc',
      });
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: sup.body.id,
        amount: 1000,
        fees: 0,
        date: TODAY,
      });
      const res = await ctx.agent.delete(`/api/insurance/${avAccountId}/supports/${sup.body.id}`);
      expect(res.status).toBe(400);
    });

    it('retourne 403 pour un compte inconnu', async () => {
      const res = await ctx.agent.delete('/api/insurance/99999/supports/1');
      expect(res.status).toBe(403);
    });

    it('retourne 404 pour un support inconnu', async () => {
      const res = await ctx.agent.delete(`/api/insurance/${avAccountId}/supports/99999`);
      expect(res.status).toBe(404);
    });
  });

  // ─── Arbitrage UC→Euro ────────────────────────────────────────────────────

  describe('POST /:accountId/arbitrage (UC → Euro)', () => {
    let ucSupportId: number;
    let euroSupportId: number;

    beforeAll(async () => {
      const u = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'UC Source Arbitrage',
        type: 'uc',
      });
      ucSupportId = u.body.id;
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: ucSupportId,
        amount: 2000,
        fees: 0,
        date: TODAY,
      });

      const e = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Euro Dest Arbitrage',
        type: 'euro',
      });
      euroSupportId = e.body.id;
    });

    it('crée un arbitrage UC → Euro et met à jour les valeurs', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/arbitrage`).send({
        from_support_id: ucSupportId,
        to_support_id: euroSupportId,
        from_amount: 500,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(201);
      expect(res.body.outOperation.type).toBe('arbitrage_out');

      const posRes = await ctx.agent.get(`/api/insurance/${avAccountId}/positions`);
      const ucPos = posRes.body.find((p: { id: number }) => p.id === ucSupportId);
      expect(ucPos.value).toBeCloseTo(1500);
      const euroPos = posRes.body.find((p: { id: number }) => p.id === euroSupportId);
      expect(euroPos.value).toBeCloseTo(500);
    });

    it('retourne 400 si solde UC insuffisant', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/arbitrage`).send({
        from_support_id: ucSupportId,
        to_support_id: euroSupportId,
        from_amount: 99999,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Erreurs 404 support introuvable ─────────────────────────────────────

  describe('404 support introuvable', () => {
    it('versement avec support inexistant → 404', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: 99999,
        amount: 100,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(404);
    });

    it('rachat avec support inexistant → 404', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/rachat`).send({
        support_id: 99999,
        amount: 100,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(404);
    });

    it('interets avec support inexistant → 404', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/interets`).send({
        support_id: 99999,
        amount: 100,
        date: TODAY,
      });
      expect(res.status).toBe(404);
    });

    it('arbitrage avec from_support inexistant → 404', async () => {
      const sup = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'UC dest 404',
        type: 'uc',
      });
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/arbitrage`).send({
        from_support_id: 99999,
        to_support_id: sup.body.id,
        from_amount: 100,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(404);
    });

    it('arbitrage avec to_support inexistant → 404', async () => {
      const sup = await ctx.agent.post(`/api/insurance/${avAccountId}/supports`).send({
        name: 'Euro src 404',
        type: 'euro',
      });
      await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: sup.body.id,
        amount: 500,
        fees: 0,
        date: TODAY,
      });
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/arbitrage`).send({
        from_support_id: sup.body.id,
        to_support_id: 99999,
        from_amount: 100,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Erreur de validation (handler) ──────────────────────────────────────

  describe('Erreurs de validation', () => {
    it('retourne 400 pour un corps invalide (versement)', async () => {
      const res = await ctx.agent.post(`/api/insurance/${avAccountId}/versement`).send({
        support_id: 1,
        amount: -100,
        fees: 0,
        date: TODAY,
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── balance_insurance dans /api/accounts ────────────────────────────────

  describe('balance_insurance dans /api/accounts', () => {
    it('expose envelope_type et balance_insurance', async () => {
      const res = await ctx.agent.get('/api/accounts');
      const account = res.body.find((a: { id: number }) => a.id === avAccountId);
      expect(account).toBeDefined();
      expect(account.envelope_type).toBe('life_insurance');
      expect(typeof account.balance_insurance).toBe('number');
    });
  });
});
