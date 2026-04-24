import { beforeAll, describe, expect, it } from 'vitest';

import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';

describe('/api/banks', () => {
  let ctx: TestContext;

  beforeAll(async () => { ctx = await createTestContext(); });

  it('GET / returns array', async () => {
    const res = await ctx.agent.get('/api/banks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST / creates a bank', async () => {
    const res = await ctx.agent.post('/api/banks').send({ name: 'TestBank' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('TestBank');
    expect(res.body.logo).toBeNull();
  });

  it('POST / returns 400 when name is missing', async () => {
    const res = await ctx.agent.post('/api/banks').send({});
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates a bank name', async () => {
    const create = await ctx.agent.post('/api/banks').send({ name: 'OldBank' });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/banks/${id}`).send({ name: 'NewBank' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('NewBank');
  });

  it('PUT /:id returns 404 for unknown bank', async () => {
    const res = await ctx.agent.put('/api/banks/99999').send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('POST /:id/logo returns 400 when no file uploaded', async () => {
    const create = await ctx.agent.post('/api/banks').send({ name: 'LogoBank' });
    const id = create.body.id;
    const res = await ctx.agent.post(`/api/banks/${id}/logo`);
    expect(res.status).toBe(400);
  });

  it('DELETE /:id removes a bank', async () => {
    const create = await ctx.agent.post('/api/banks').send({ name: 'ToDeleteBank' });
    const res = await ctx.agent.delete(`/api/banks/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE /:id returns 404 for unknown bank', async () => {
    expect((await ctx.agent.delete('/api/banks/99999')).status).toBe(404);
  });
});
