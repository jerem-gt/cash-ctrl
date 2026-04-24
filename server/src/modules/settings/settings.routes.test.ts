import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';

describe('/api/settings', () => {
  let ctx: TestContext;

  beforeAll(async () => { ctx = await createTestContext(); });

  it('GET / returns default lead_days of 30', async () => {
    const res = await ctx.agent.get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.lead_days).toBe(30);
  });

  it('GET / returns 401 without auth', async () => {
    expect((await supertest(ctx.app).get('/api/settings')).status).toBe(401);
  });

  it('PUT / updates lead_days', async () => {
    const res = await ctx.agent.put('/api/settings').send({ lead_days: 60 });
    expect(res.status).toBe(200);
    expect(res.body.lead_days).toBe(60);
  });

  it('GET / returns updated lead_days after PUT', async () => {
    await ctx.agent.put('/api/settings').send({ lead_days: 45 });
    const res = await ctx.agent.get('/api/settings');
    expect(res.body.lead_days).toBe(45);
  });

  it('PUT / returns 400 when lead_days > 365', async () => {
    const res = await ctx.agent.put('/api/settings').send({ lead_days: 366 });
    expect(res.status).toBe(400);
  });

  it('PUT / returns 400 when lead_days < 0', async () => {
    const res = await ctx.agent.put('/api/settings').send({ lead_days: -1 });
    expect(res.status).toBe(400);
  });

  it('PUT / returns 400 when lead_days is not a number', async () => {
    const res = await ctx.agent.put('/api/settings').send({ lead_days: 'beaucoup' });
    expect(res.status).toBe(400);
  });
});
