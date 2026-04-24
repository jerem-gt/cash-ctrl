import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext, type TestContext } from '../../tests/helpers/testApp.js';

describe('/api/payment-methods', () => {
  let ctx: TestContext;

  beforeAll(async () => { ctx = await createTestContext(); });

  it('GET / returns array', async () => {
    const res = await ctx.agent.get('/api/payment-methods');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST / creates a payment method', async () => {
    const res = await ctx.agent.post('/api/payment-methods').send({ name: 'Apple Pay', icon: '🍎' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Apple Pay');
    expect(res.body.icon).toBe('🍎');
  });

  it('POST / applies default empty icon', async () => {
    const res = await ctx.agent.post('/api/payment-methods').send({ name: 'NoIcon' });
    expect(res.status).toBe(201);
    expect(res.body.icon).toBe('');
  });

  it('POST / returns 400 when name is missing', async () => {
    const res = await ctx.agent.post('/api/payment-methods').send({});
    expect(res.status).toBe(400);
  });

  it('POST / returns 400 when name is too long', async () => {
    const res = await ctx.agent.post('/api/payment-methods').send({ name: 'x'.repeat(51) });
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates a payment method', async () => {
    const create = await ctx.agent.post('/api/payment-methods').send({ name: 'OldMethod' });
    const id = create.body.id;
    const res = await ctx.agent.put(`/api/payment-methods/${id}`).send({ name: 'NewMethod', icon: '✨' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('NewMethod');
  });

  it('PUT /:id returns 404 for unknown method', async () => {
    const res = await ctx.agent.put('/api/payment-methods/99999').send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id removes a payment method', async () => {
    const create = await ctx.agent.post('/api/payment-methods').send({ name: 'ToDelete2' });
    const res = await ctx.agent.delete(`/api/payment-methods/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
