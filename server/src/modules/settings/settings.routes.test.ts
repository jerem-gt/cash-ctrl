import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';
import { SEED } from '../../tests/helpers/testDb.js';

const VALID_SETTINGS = {
  lead_days: 30,
  backup_enabled: false,
  backup_frequency_h: 24,
  backup_max_files: 7,
};

describe('/api/settings', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it('GET / retourne 401 sans authentification', async () => {
    expect((await supertest(ctx.app).get('/api/settings')).status).toBe(401);
  });

  it('GET / retourne les valeurs par défaut', async () => {
    const res = await ctx.agent.get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.lead_days).toBe(30);
    expect(res.body.backup_enabled).toBe(false);
    expect(res.body.backup_frequency_h).toBe(24);
    expect(res.body.backup_max_files).toBe(7);
    expect(res.body.backup_last_at).toBeNull();
  });

  it('GET / retourne les 6 champs system refs (non null car seedTestReferenceData les peuple)', async () => {
    const res = await ctx.agent.get('/api/settings');
    expect(res.status).toBe(200);
    // financial_income_category_id is set by seedTestReferenceData
    expect(res.body.financial_income_category_id).not.toBeNull();
    expect(typeof res.body.financial_income_category_id).toBe('number');
    // transfer refs are also set
    expect(res.body.transfer_subcategory_id).not.toBeNull();
    expect(res.body.transfer_payment_method_id).not.toBeNull();
  });

  it('PUT / met à jour lead_days', async () => {
    const res = await ctx.agent.put('/api/settings').send({ ...VALID_SETTINGS, lead_days: 60 });
    expect(res.status).toBe(200);
    expect(res.body.lead_days).toBe(60);
  });

  it('PUT / active le backup', async () => {
    const res = await ctx.agent.put('/api/settings').send({
      ...VALID_SETTINGS,
      backup_enabled: true,
      backup_frequency_h: 12,
      backup_max_files: 3,
    });
    expect(res.status).toBe(200);
    expect(res.body.backup_enabled).toBe(true);
    expect(res.body.backup_frequency_h).toBe(12);
    expect(res.body.backup_max_files).toBe(3);
  });

  it('GET / retourne les paramètres mis à jour après PUT', async () => {
    await ctx.agent.put('/api/settings').send({ ...VALID_SETTINGS, lead_days: 45 });
    const res = await ctx.agent.get('/api/settings');
    expect(res.body.lead_days).toBe(45);
  });

  it('PUT / retourne 400 quand lead_days > 365', async () => {
    expect(
      (await ctx.agent.put('/api/settings').send({ ...VALID_SETTINGS, lead_days: 366 })).status,
    ).toBe(400);
  });

  it('PUT / retourne 400 quand lead_days < 0', async () => {
    expect(
      (await ctx.agent.put('/api/settings').send({ ...VALID_SETTINGS, lead_days: -1 })).status,
    ).toBe(400);
  });

  it('PUT / retourne 400 quand backup_frequency_h < 1', async () => {
    expect(
      (await ctx.agent.put('/api/settings').send({ ...VALID_SETTINGS, backup_frequency_h: 0 }))
        .status,
    ).toBe(400);
  });

  it('PUT / retourne 400 quand backup_max_files < 1', async () => {
    expect(
      (await ctx.agent.put('/api/settings').send({ ...VALID_SETTINGS, backup_max_files: 0 }))
        .status,
    ).toBe(400);
  });

  it("PUT / retourne 400 quand backup_enabled n'est pas un booléen", async () => {
    expect(
      (await ctx.agent.put('/api/settings').send({ ...VALID_SETTINGS, backup_enabled: 'oui' }))
        .status,
    ).toBe(400);
  });

  describe('PATCH /system-refs', () => {
    it('met à jour financial_income_category_id avec un id valide', async () => {
      const catId = ctx.db
        .prepare('SELECT id FROM categories WHERE user_id = ? LIMIT 1')
        .get(ctx.userId) as { id: number } | undefined;
      expect(catId).toBeDefined();

      const res = await ctx.agent
        .patch('/api/settings/system-refs')
        .send({ financial_income_category_id: catId!.id });
      expect(res.status).toBe(200);
      expect(res.body.financial_income_category_id).toBe(catId!.id);
    });

    it('accepte null pour effacer une référence', async () => {
      const res = await ctx.agent
        .patch('/api/settings/system-refs')
        .send({ financial_income_category_id: null });
      expect(res.status).toBe(200);
      expect(res.body.financial_income_category_id).toBeNull();
    });

    it("retourne 400 quand la catégorie n'appartient pas à l'utilisateur", async () => {
      // Create another user's category (hack directly in DB)
      ctx.db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('other', 'x');
      const other = ctx.db.prepare("SELECT id FROM users WHERE username = 'other'").get() as {
        id: number;
      };
      ctx.db
        .prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)')
        .run(other.id, 'OtherCat', '❓');
      const otherCat = ctx.db
        .prepare("SELECT id FROM categories WHERE user_id = ? AND name = 'OtherCat'")
        .get(other.id) as { id: number };

      const res = await ctx.agent
        .patch('/api/settings/system-refs')
        .send({ financial_income_category_id: otherCat.id });
      expect(res.status).toBe(400);
    });

    it("retourne 400 quand le payment_method n'appartient pas à l'utilisateur", async () => {
      ctx.db
        .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
        .run('other2', 'x');
      const other = ctx.db.prepare("SELECT id FROM users WHERE username = 'other2'").get() as {
        id: number;
      };
      ctx.db
        .prepare('INSERT INTO payment_methods (user_id, name, icon) VALUES (?, ?, ?)')
        .run(other.id, 'OtherPM', '❓');
      const otherPm = ctx.db
        .prepare("SELECT id FROM payment_methods WHERE user_id = ? AND name = 'OtherPM'")
        .get(other.id) as { id: number };

      const res = await ctx.agent
        .patch('/api/settings/system-refs')
        .send({ prelevement_payment_method_id: otherPm.id });
      expect(res.status).toBe(400);
    });

    it('met à jour plusieurs refs à la fois', async () => {
      const subcatId = SEED.SUBCAT_TRANSFERT;
      const pmId = SEED.PM_TRANSFERT;

      const res = await ctx.agent.patch('/api/settings/system-refs').send({
        transfer_subcategory_id: subcatId,
        transfer_payment_method_id: pmId,
      });
      expect(res.status).toBe(200);
      expect(res.body.transfer_subcategory_id).toBe(subcatId);
      expect(res.body.transfer_payment_method_id).toBe(pmId);
    });

    it('retourne 400 pour un champ inconnu (schema strict)', async () => {
      const res = await ctx.agent.patch('/api/settings/system-refs').send({ unknown_field: 123 });
      expect(res.status).toBe(400);
    });
  });
});
