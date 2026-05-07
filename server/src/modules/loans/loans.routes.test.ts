import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

describe('/api/loans', () => {
  let ctx: TestContext;
  let sourceAccountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    ctx.db
      .prepare("INSERT INTO account_types (user_id, name, is_loan) VALUES (?, 'Prêt', 1)")
      .run(ctx.userId);

    const src = await ctx.agent.post('/api/accounts').send({
      name: 'Compte courant source',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_COURANT,
      initial_balance: 10000,
      opening_date: '2024-01-01',
    });
    sourceAccountId = src.body.id;
  });

  // --- Creation ---------------------------------------------------------------

  describe('POST /', () => {
    it('cree un pret et genere le bon nombre de mensualites', async () => {
      const res = await ctx.agent.post('/api/loans').send({
        name: 'Pret test',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-01-01',
        principal_amount: 12000,
        interest_rate: 0.12,
        duration_months: 12,
        start_date: '2027-02-01',
        source_account_id: sourceAccountId,
      });

      expect(res.status).toBe(201);
      expect(res.body.principal_amount).toBe(12000);
      expect(res.body.duration_months).toBe(12);
      expect(res.body.account_id).toBeGreaterThan(0);
      expect(res.body.source_account_id).toBe(sourceAccountId);

      const instRes = await ctx.agent.get(`/api/loans/${res.body.id}/installments`);
      expect(instRes.body).toHaveLength(12);
    });

    it('calcule la mensualite a 0% comme principal divise par duree', async () => {
      const res = await ctx.agent.post('/api/loans').send({
        name: 'Pret sans interets',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-01-01',
        principal_amount: 1200,
        interest_rate: 0,
        duration_months: 12,
        start_date: '2027-02-01',
        source_account_id: sourceAccountId,
      });

      expect(res.status).toBe(201);
      expect(res.body.monthly_payment).toBe(100);
    });

    it("la somme des capitaux de l'echeancier est egale au capital emprunte", async () => {
      const res = await ctx.agent.post('/api/loans').send({
        name: 'Pret amortissement',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-01-01',
        principal_amount: 12000,
        interest_rate: 0.06,
        duration_months: 24,
        start_date: '2027-02-01',
        source_account_id: sourceAccountId,
      });

      expect(res.status).toBe(201);
      const instRes = await ctx.agent.get(`/api/loans/${res.body.id}/installments`);
      const totalPrincipal = (instRes.body as { principal_amount: number }[]).reduce(
        (sum, i) => sum + i.principal_amount,
        0,
      );
      expect(Math.abs(totalPrincipal - 12000)).toBeLessThan(0.02);
    });

    it('retourne 400 pour un payload invalide', async () => {
      const res = await ctx.agent.post('/api/loans').send({
        name: '',
        principal_amount: -1,
        duration_months: 0,
      });
      expect(res.status).toBe(400);
    });
  });

  // --- Recuperation par compte ------------------------------------------------

  describe('GET /account/:accountId', () => {
    let loanAccountId: number;

    beforeAll(async () => {
      const createRes = await ctx.agent.post('/api/loans').send({
        name: 'Pret immo',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-01-01',
        principal_amount: 200000,
        interest_rate: 0.035,
        duration_months: 240,
        start_date: '2027-02-01',
        source_account_id: sourceAccountId,
      });
      loanAccountId = createRes.body.account_id;
    });

    it('retourne le pret associe au compte', async () => {
      const res = await ctx.agent.get(`/api/loans/account/${loanAccountId}`);
      expect(res.status).toBe(200);
      expect(res.body.principal_amount).toBe(200000);
      expect(res.body.account_id).toBe(loanAccountId);
    });

    it('retourne 404 pour un compte sans pret', async () => {
      const res = await ctx.agent.get(`/api/loans/account/${sourceAccountId}`);
      expect(res.status).toBe(404);
    });
  });

  // --- Mise a jour ------------------------------------------------------------

  describe('PATCH /:loanId', () => {
    let loanId: number;
    let loanAccountId: number;

    beforeAll(async () => {
      const createRes = await ctx.agent.post('/api/loans').send({
        name: 'Pret a modifier',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-01-01',
        principal_amount: 5000,
        interest_rate: 0.05,
        duration_months: 24,
        start_date: '2027-02-01',
        source_account_id: sourceAccountId,
      });
      loanId = createRes.body.id;
      loanAccountId = createRes.body.account_id;
    });

    it('met a jour le nom et la date du compte associe', async () => {
      const res = await ctx.agent.patch(`/api/loans/${loanId}`).send({
        name: 'Nom modifie',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-06-01',
        source_account_id: sourceAccountId,
      });

      expect(res.status).toBe(200);

      const accRes = await ctx.agent.get('/api/accounts');
      const account = (accRes.body as { id: number; name: string; opening_date: string }[]).find(
        (a) => a.id === loanAccountId,
      );
      expect(account?.name).toBe('Nom modifie');
      expect(account?.opening_date).toBe('2024-06-01');
    });

    it('retourne 400 pour un payload invalide', async () => {
      const res = await ctx.agent.patch(`/api/loans/${loanId}`).send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('retourne 404 pour un pret inconnu', async () => {
      const res = await ctx.agent.patch('/api/loans/99999').send({
        name: 'Test',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-01-01',
        source_account_id: sourceAccountId,
      });
      expect(res.status).toBe(404);
    });
  });

  // --- Echeancier -------------------------------------------------------------

  describe('GET /:loanId/installments', () => {
    let loanId: number;

    beforeAll(async () => {
      // Future start_date keeps generateScheduledTransactions from pre-linking transactions
      const createRes = await ctx.agent.post('/api/loans').send({
        name: 'Pret echeancier',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-01-01',
        principal_amount: 12000,
        interest_rate: 0.06,
        duration_months: 12,
        start_date: '2027-01-01',
        source_account_id: sourceAccountId,
      });
      loanId = createRes.body.id;
    });

    it('retourne toutes les mensualites dans le bon ordre', async () => {
      const res = await ctx.agent.get(`/api/loans/${loanId}/installments`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(12);
      expect(res.body[0].installment_number).toBe(1);
      expect(res.body[11].installment_number).toBe(12);
    });

    it('les dates progressent mensuellement depuis start_date', async () => {
      const res = await ctx.agent.get(`/api/loans/${loanId}/installments`);
      expect(res.body[0].due_date).toBe('2027-01-01');
      expect(res.body[1].due_date).toBe('2027-02-01');
      expect(res.body[11].due_date).toBe('2027-12-01');
    });

    it('les interets de la premiere mensualite egale principal x taux mensuel', async () => {
      const res = await ctx.agent.get(`/api/loans/${loanId}/installments`);
      // 12 000 x (6% / 12) = 60
      expect(res.body[0].interest_amount).toBe(60);
    });

    it('les mensualites ne sont pas encore liees a une transaction', async () => {
      const res = await ctx.agent.get(`/api/loans/${loanId}/installments`);
      expect(res.body[0].transaction_id).toBeNull();
      expect(res.body[0].transaction_validated).toBeNull();
    });
  });

  // --- Modification mensualite ------------------------------------------------

  describe('PATCH /:loanId/installments/:installmentId', () => {
    let loanId: number;
    let installmentId: number;

    beforeAll(async () => {
      const createRes = await ctx.agent.post('/api/loans').send({
        name: 'Pret modif mensualite',
        bank_id: SEED.BANK_ID,
        opening_date: '2024-01-01',
        principal_amount: 6000,
        interest_rate: 0,
        duration_months: 6,
        start_date: '2027-01-01',
        source_account_id: sourceAccountId,
      });
      loanId = createRes.body.id;

      const instRes = await ctx.agent.get(`/api/loans/${loanId}/installments`);
      installmentId = instRes.body[0].id;
    });

    it('met a jour la date et le montant de la mensualite', async () => {
      const res = await ctx.agent
        .patch(`/api/loans/${loanId}/installments/${installmentId}`)
        .send({ due_date: '2027-03-15', total_amount: 1100 });

      expect(res.status).toBe(200);
      expect(res.body.due_date).toBe('2027-03-15');
      expect(res.body.total_amount).toBe(1100);
    });

    it('retourne 400 pour un montant negatif', async () => {
      const res = await ctx.agent
        .patch(`/api/loans/${loanId}/installments/${installmentId}`)
        .send({ due_date: '2027-03-01', total_amount: -100 });
      expect(res.status).toBe(400);
    });

    it('retourne 404 pour une mensualite inconnue', async () => {
      const res = await ctx.agent
        .patch(`/api/loans/${loanId}/installments/99999`)
        .send({ due_date: '2027-03-01', total_amount: 1000 });
      expect(res.status).toBe(404);
    });
  });
});
