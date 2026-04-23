import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext, type TestContext } from '../helpers/testApp.js';

describe('/api/account-types', () => {
  let ctx: TestContext;

  beforeAll(async () => { ctx = await createTestContext(); });

  it('GET / returns array', async () => {
    const res = await ctx.agent.get('/api/account-types');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST / creates an account type', async () => {
    const res = await ctx.agent.post('/api/account-types').send({ name: 'PEA' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('PEA');
  });

  it('POST / returns 400 when name is missing', async () => {
    const res = await ctx.agent.post('/api/account-types').send({});
    expect(res.status).toBe(400);
  });

  it('POST / returns 400 when name is too long', async () => {
    const res = await ctx.agent.post('/api/account-types').send({ name: 'x'.repeat(51) });
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates an account type', async () => {
    const create = await ctx.agent.post('/api/account-types').send({ name: 'OldType' });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/account-types/${id}`).send({ name: 'NewType' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('NewType');
  });

  it('PUT /:id returns 404 for unknown type', async () => {
    const res = await ctx.agent.put('/api/account-types/99999').send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes an account type', async () => {
    const create = await ctx.agent.post('/api/account-types').send({ name: 'ToRemove' });
    const res = await ctx.agent.delete(`/api/account-types/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE /:id returns 404 for unknown type', async () => {
    expect((await ctx.agent.delete('/api/account-types/99999')).status).toBe(404);
  });
});
