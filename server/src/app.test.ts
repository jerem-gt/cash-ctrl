import supertest from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { createTestDb } from './tests/helpers/testDb.js';

describe('createApp', () => {
  it('lève une erreur sans sessionSecret hors NODE_ENV=test', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(() => createApp(createTestDb())).toThrow(/sessionSecret/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('accepte un sessionSecret explicite hors test', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(() => createApp(createTestDb(), { sessionSecret: 's3cret' })).not.toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('retourne 413 pour un corps > 100 ko sur une route standard', async () => {
    const res = await supertest(createApp(createTestDb()))
      .post('/api/auth/login')
      .send({ username: 'a', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('common.payload_too_large');
  });

  it('retourne 400 pour un JSON malformé', async () => {
    const res = await supertest(createApp(createTestDb()))
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/health', () => {
  it('retourne 200 ok sans check supplémentaire', async () => {
    const app = createApp(createTestDb());
    const res = await supertest(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('retourne 200 si le check supplémentaire passe', async () => {
    const app = createApp(createTestDb(), { healthExtraCheck: () => null });
    const res = await supertest(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('retourne 503 avec la raison du check supplémentaire', async () => {
    const app = createApp(createTestDb(), { healthExtraCheck: () => 'frontend' });
    const res = await supertest(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, reason: 'frontend' });
  });

  it('retourne 503 reason db si la base est inaccessible', async () => {
    const db = createTestDb();
    const app = createApp(db, { healthExtraCheck: () => 'frontend' });
    db.close();
    const res = await supertest(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, reason: 'db' });
  });
});
