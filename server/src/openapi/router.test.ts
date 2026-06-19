import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTestDb } from '../tests/helpers/testDb';

describe('GET /api/docs/openapi.json', () => {
  it('retourne la spec OpenAPI 3.1 avec les champs attendus', async () => {
    const db = createTestDb();
    const app = createApp(db);
    const res = await supertest(app).get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.info).toBeDefined();
    expect(typeof res.body.info.title).toBe('string');
    expect(res.body.paths).toBeDefined();
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(0);
  });

  it('retourne du JSON valide (Content-Type application/json)', async () => {
    const db = createTestDb();
    const app = createApp(db);
    const res = await supertest(app).get('/api/docs/openapi.json');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
