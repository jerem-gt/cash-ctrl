import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';

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
});
