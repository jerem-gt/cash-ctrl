import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const TODAY = new Date().toISOString().split('T')[0];

async function setupWithAccount(ctx: TestContext) {
  const acc = await ctx.agent.post('/api/accounts').send({
    name: 'Main',
    bank_id: SEED.BANK_ID,
    account_type_id: SEED.AT_COURANT,
    opening_date: '2020-01-01',
  });
  return acc.body.id as number;
}

describe('/api/transactions', () => {
  let ctx: TestContext;
  let accountId: number;

  beforeAll(async () => {
    ctx = await createTestContext();
    accountId = await setupWithAccount(ctx);
  });

  it('GET / returns 401 without auth', async () => {
    const res = await supertest(ctx.app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  it('GET / returns paginated result initially', async () => {
    const res = await ctx.agent.get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });

  it('POST / creates a transaction', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 1000,
      description: 'Salaire',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(1000);
    expect(res.body.account_name).toBe('Main');
  });

  it('POST / returns 403 for a non-owned account', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: 99999,
      type: 'income',
      amount: 100,
      description: 'x',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(403);
  });

  it('POST / returns 400 for invalid data', async () => {
    const res = await ctx.agent.post('/api/transactions').send({ account_id: accountId });
    expect(res.status).toBe(400);
  });

  it('GET / filters by type', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 50,
      description: 'Courses',
      subcategory_id: SEED.SUBCAT_SUPERMARCHE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const res = await ctx.agent.get('/api/transactions?type=expense');
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { type: string }) => t.type === 'expense')).toBe(true);
  });

  it('PUT /:id updates a normal transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 20,
      description: 'Café',
      subcategory_id: SEED.SUBCAT_CINEMA,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({
      account_id: accountId,
      type: 'expense',
      amount: 25,
      description: 'Café maj',
      subcategory_id: SEED.SUBCAT_CINEMA,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(25);
    expect(res.body.description).toBe('Café maj');
  });

  it('PUT /:id returns 404 for unknown transaction', async () => {
    const res = await ctx.agent.put('/api/transactions/99999').send({
      account_id: accountId,
      type: 'expense',
      amount: 1,
      description: 'x',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(404);
  });

  it('PATCH /:id/validate toggles validated flag', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 500,
      description: 'Prime',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    const id = create.body.id;
    const res = await ctx.agent.patch(`/api/transactions/${id}/validate`).send({ validated: true });
    expect(res.status).toBe(200);
    expect(res.body.validated).toBe(1);
  });

  it('DELETE /:id removes a transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 10,
      description: 'ToDelete',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const del = await ctx.agent.delete(`/api/transactions/${id}`);
    expect(del.status).toBe(200);
  });

  it('DELETE /:id returns 404 for unknown transaction', async () => {
    const res = await ctx.agent.delete('/api/transactions/99999');
    expect(res.status).toBe(404);
  });

  // ─── Ventilation (splits) ──────────────────────────────────────────────────

  it('POST / crée une transaction ventilée et retourne les splits', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 500,
      description: 'Assurance',
      splits: [
        { subcategory_id: SEED.SUBCAT_AUTRE, amount: 200 },
        { subcategory_id: SEED.SUBCAT_LOYER, amount: 300 },
      ],
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    expect(res.status).toBe(201);
    expect(res.body.subcategory_id).toBeNull();
    expect(res.body.splits).toHaveLength(2);
  });

  it('POST / retourne 400 si ni subcategory_id ni splits ne sont fournis', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 100,
      description: 'Test',
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(400);
  });

  it('POST / retourne 400 si subcategory_id et splits sont fournis simultanément', async () => {
    const res = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 100,
      description: 'Test',
      subcategory_id: SEED.SUBCAT_AUTRE,
      splits: [{ subcategory_id: SEED.SUBCAT_CINEMA, amount: 100 }],
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(400);
  });

  it('PUT /:id passe une transaction normale en ventilée', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 200,
      description: 'Multi-poste',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({
      account_id: accountId,
      type: 'expense',
      amount: 200,
      description: 'Multi-poste ventilé',
      splits: [
        { subcategory_id: SEED.SUBCAT_AUTRE, amount: 100 },
        { subcategory_id: SEED.SUBCAT_CINEMA, amount: 100 },
      ],
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
      validated: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.subcategory_id).toBeNull();
    expect(res.body.splits).toHaveLength(2);
  });

  it('GET / inclut les splits pour les transactions ventilées', async () => {
    await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 300,
      description: 'Ventilée-list',
      splits: [
        { subcategory_id: SEED.SUBCAT_AUTRE, amount: 150 },
        { subcategory_id: SEED.SUBCAT_LOYER, amount: 150 },
      ],
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    const res = await ctx.agent.get('/api/transactions');
    const tx = res.body.data.find(
      (t: { description: string }) => t.description === 'Ventilée-list',
    );
    expect(tx).toBeDefined();
    expect(tx.splits).toHaveLength(2);
  });

  // ─── GET / filtres supplémentaires ────────────────────────────────────────

  it('GET / filtre par account_id', async () => {
    const acc2 = await ctx.agent.post('/api/accounts').send({
      name: 'Épargne',
      bank_id: SEED.BANK_ID,
      account_type_id: SEED.AT_EPARGNE,
      opening_date: '2021-01-01',
    });
    const acc2Id = acc2.body.id as number;
    await ctx.agent.post('/api/transactions').send({
      account_id: acc2Id,
      type: 'income',
      amount: 50,
      description: 'Intérêts',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    const res = await ctx.agent.get(`/api/transactions?account_id=${acc2Id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { account_id: number }) => t.account_id === acc2Id)).toBe(true);
  });

  it('GET / filtre par subcategory_id', async () => {
    const res = await ctx.agent.get(`/api/transactions?subcategory_id=${SEED.SUBCAT_SALAIRE}`);
    expect(res.status).toBe(200);
    expect(
      res.body.data.every(
        (t: { subcategory_id: number }) => t.subcategory_id === SEED.SUBCAT_SALAIRE,
      ),
    ).toBe(true);
  });

  it('GET / pagination limit=1 retourne une seule transaction', async () => {
    const res = await ctx.agent.get('/api/transactions?limit=1&page=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.totalPages).toBeGreaterThan(1);
  });

  it('GET / retourne 400 pour un paramètre type invalide', async () => {
    const res = await ctx.agent.get('/api/transactions?type=invalid');
    expect(res.status).toBe(400);
  });

  // ─── PUT /:id cas limites (transaction normale) ───────────────────────────

  it('PUT /:id retourne 400 pour données invalides', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 10,
      description: 'Test400',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({ amount: -1 });
    expect(res.status).toBe(400);
  });

  it('PUT /:id retourne 403 pour un compte non possédé', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'expense',
      amount: 10,
      description: 'Test403',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/transactions/${id}`).send({
      account_id: 99999,
      type: 'expense',
      amount: 10,
      description: 'Test403',
      subcategory_id: SEED.SUBCAT_AUTRE,
      date: TODAY,
      payment_method_id: SEED.PM_CARTE,
    });
    expect(res.status).toBe(403);
  });

  // ─── PATCH /:id/validate cas limites ─────────────────────────────────────

  it('PATCH /:id/validate retourne 404 pour une transaction inconnue', async () => {
    const res = await ctx.agent.patch('/api/transactions/99999/validate').send({ validated: true });
    expect(res.status).toBe(404);
  });

  it('PATCH /:id/validate retourne 400 pour un body invalide', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 100,
      description: 'ValidateTest',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
    });
    const id = create.body.id;
    const res = await ctx.agent.patch(`/api/transactions/${id}/validate`).send({});
    expect(res.status).toBe(400);
  });

  it('PATCH /:id/validate peut dévalider une transaction', async () => {
    const create = await ctx.agent.post('/api/transactions').send({
      account_id: accountId,
      type: 'income',
      amount: 100,
      description: 'Devalider',
      subcategory_id: SEED.SUBCAT_SALAIRE,
      date: TODAY,
      payment_method_id: SEED.PM_VIREMENT,
      validated: true,
    });
    const id = create.body.id;
    await ctx.agent.patch(`/api/transactions/${id}/validate`).send({ validated: true });
    const res = await ctx.agent
      .patch(`/api/transactions/${id}/validate`)
      .send({ validated: false });
    expect(res.status).toBe(200);
    expect(res.body.validated).toBe(0);
  });

  // ─── Transferts ───────────────────────────────────────────────────────────

  describe('transferts (transfer_peer_id)', () => {
    let transferTxId: number;
    let account2Id: number;

    beforeAll(async () => {
      const acc2 = await ctx.agent.post('/api/accounts').send({
        name: 'Épargne transfert',
        bank_id: SEED.BANK_ID,
        account_type_id: SEED.AT_EPARGNE,
        opening_date: '2021-01-01',
      });
      account2Id = acc2.body.id as number;

      const transfer = await ctx.agent.post('/api/transfers').send({
        from_account_id: accountId,
        to_account_id: account2Id,
        amount: 500,
        description: 'Virement épargne',
        date: TODAY,
      });
      // expense = transaction source (from_account, type expense)
      transferTxId = transfer.body.expense.id as number;
    });

    it('PUT /:id met à jour un transfert (montant + date)', async () => {
      const res = await ctx.agent.put(`/api/transactions/${transferTxId}`).send({
        amount: 600,
        description: 'Virement maj',
        date: TODAY,
        validated: false,
      });
      expect(res.status).toBe(200);
      expect(res.body.amount).toBe(600);
      expect(res.body.description).toBe('Virement maj');
    });

    it('PUT /:id transfert retourne 400 pour données invalides', async () => {
      const res = await ctx.agent.put(`/api/transactions/${transferTxId}`).send({
        amount: -1,
      });
      expect(res.status).toBe(400);
    });

    it('PUT /:id transfert retourne 403 si from_account_id non possédé', async () => {
      const res = await ctx.agent.put(`/api/transactions/${transferTxId}`).send({
        amount: 500,
        description: 'Test',
        date: TODAY,
        validated: false,
        from_account_id: 99999,
      });
      expect(res.status).toBe(403);
    });

    it('PUT /:id transfert retourne 403 si to_account_id non possédé', async () => {
      const res = await ctx.agent.put(`/api/transactions/${transferTxId}`).send({
        amount: 500,
        description: 'Test',
        date: TODAY,
        validated: false,
        to_account_id: 99999,
      });
      expect(res.status).toBe(403);
    });

    it('DELETE /:id supprime un transfert et son pair', async () => {
      const transfer = await ctx.agent.post('/api/transfers').send({
        from_account_id: accountId,
        to_account_id: account2Id,
        amount: 100,
        description: 'À supprimer',
        date: TODAY,
      });
      const txId = transfer.body.expense.id as number;
      const peerId = transfer.body.income.id as number;
      const del = await ctx.agent.delete(`/api/transactions/${txId}`);
      expect(del.status).toBe(200);
      expect(del.body.ok).toBe(true);
      // Le pair doit aussi avoir disparu
      const check = await ctx.agent.delete(`/api/transactions/${peerId}`);
      expect(check.status).toBe(404);
    });
  });

  describe('Transactions Pagination & Balance', () => {
    beforeAll(async () => {
      ctx = await createTestContext();
      accountId = await setupWithAccount(ctx);
    });

    it('devrait retourner un résultat vide initialement (EMPTY_PAGINATED_RESULT)', async () => {
      const res = await ctx.agent.get(`/api/transactions?account_id=${accountId}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.balance_before_page).toBe(0);
    });

    it('devrait calculer correctement le balance_before_page sur la page 2', async () => {
      // 1. On insère 3 transactions (limitera la page à 2 pour le test)
      // Transaction la plus ancienne (sera en page 2)
      await ctx.agent.post('/api/transactions').send({
        account_id: accountId,
        type: 'income',
        amount: 100,
        description: 'Salaire',
        subcategory_id: SEED.SUBCAT_SALAIRE,
        date: '2024-01-01',
        payment_method_id: SEED.PM_VIREMENT,
      });

      // Transactions plus récentes (seront en page 1)
      await ctx.agent.post('/api/transactions').send({
        account_id: accountId,
        type: 'expense',
        amount: 30,
        description: 'Courses',
        subcategory_id: SEED.SUBCAT_SUPERMARCHE,
        date: '2024-01-02',
        payment_method_id: SEED.PM_VIREMENT,
      });

      await ctx.agent.post('/api/transactions').send({
        account_id: accountId,
        type: 'expense',
        amount: 20,
        description: 'Loisirs',
        subcategory_id: SEED.SUBCAT_CINEMA,
        date: '2024-01-03',
        payment_method_id: SEED.PM_VIREMENT,
      });

      // 2. Test Page 1 (limit=2)
      const resPage1 = await ctx.agent.get(
        `/api/transactions?account_id=${accountId}&limit=2&page=1`,
      );
      expect(resPage1.body.data).toHaveLength(2);
      expect(resPage1.body.balance_before_page).toBe(0); // Page 1 toujours 0
      expect(resPage1.body.total).toBe(3);

      // 3. Test Page 2 (limit=2)
      const resPage2 = await ctx.agent.get(
        `/api/transactions?account_id=${accountId}&limit=2&page=2`,
      );

      expect(resPage2.body.data).toHaveLength(1);
      expect(resPage2.body.data[0].description).toBe('Salaire');

      // Le solde AVANT la page 2 correspond à la somme des dépenses de la page 1 (-30 + -20 = -50)
      // car on trie par date DESC (les plus récentes d'abord)
      expect(resPage2.body.balance_before_page).toBe(-50);
    });

    it('devrait gérer le tri par ID en cas de dates identiques pour le solde', async () => {
      const commonDate = '2024-05-01';

      // Insertion de 2 transactions le même jour
      await ctx.agent.post('/api/transactions').send({
        account_id: accountId,
        type: 'income',
        amount: 1000,
        date: commonDate,
        description: 'Premier',
        subcategory_id: SEED.SUBCAT_CINEMA,
        payment_method_id: SEED.PM_VIREMENT,
      });
      await ctx.agent.post('/api/transactions').send({
        account_id: accountId,
        type: 'expense',
        amount: 200,
        date: commonDate,
        description: 'Second',
        subcategory_id: SEED.SUBCAT_CINEMA,
        payment_method_id: SEED.PM_VIREMENT,
      });

      // On demande la page 2 avec une limite de 1
      const res = await ctx.agent.get(`/api/transactions?account_id=${accountId}&limit=1&page=2`);

      // La plus récente (ID le plus grand) est en page 1, la première est en page 2
      expect(res.body.data[0].description).toBe('Premier');
      // Le solde avant devrait être celui de la transaction "Second" (-200)
      expect(res.body.balance_before_page).toBe(-200);
    });
  });
});
