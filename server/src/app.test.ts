import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { createTestDb } from './tests/helpers/testDb.js';

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
