import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDb } from '../../tests/helpers/testDb.js';
import { SetupToken } from './setup.js';

function setup() {
  const db = createTestDb();
  const setupToken = new SetupToken();
  const app = createApp(db, { setupToken });
  return { db, app, setupToken, token: setupToken.current() as string };
}

const body = (token: string, extra: object = {}) => ({
  token,
  username: 'jerem',
  password: 'password123',
  ...extra,
});

describe('GET /api/auth/setup', () => {
  it('retourne required: true sans utilisateur', async () => {
    const { app } = setup();
    const res = await supertest(app).get('/api/auth/setup');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ required: true });
  });

  it('retourne required: false dès qu’un utilisateur existe', async () => {
    const { app, db } = setup();
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('alice', 'x');
    const res = await supertest(app).get('/api/auth/setup');
    expect(res.body).toEqual({ required: false });
  });
});

describe('POST /api/auth/setup', () => {
  it('crée le premier compte admin, le seed et ouvre la session', async () => {
    const { app, db, token } = setup();
    const agent = supertest.agent(app);
    const res = await agent.post('/api/auth/setup').send(body(token, { lang: 'en' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: expect.any(Number),
      username: 'jerem',
      isAdmin: true,
      totpEnabled: false,
    });

    const user = db.prepare('SELECT id, is_admin FROM users').get() as {
      id: number;
      is_admin: number;
    };
    expect(user.is_admin).toBe(1);
    const cat = db
      .prepare("SELECT 1 FROM categories WHERE user_id = ? AND name = 'Financial income'")
      .get(user.id);
    expect(cat).toBeDefined();

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.isAdmin).toBe(true);
  });

  it('invalide le jeton après usage (409 setup_done)', async () => {
    const { app, token, setupToken } = setup();
    await supertest(app).post('/api/auth/setup').send(body(token));
    expect(setupToken.current()).toBeNull();
    const res = await supertest(app)
      .post('/api/auth/setup')
      .send(body(token, { username: 'x' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('auth.setup_done');
  });

  it('retourne 409 si un compte existe déjà', async () => {
    const { app, db, token } = setup();
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('alice', 'x');
    const res = await supertest(app).post('/api/auth/setup').send(body(token));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('auth.setup_done');
  });

  it('retourne 403 si le jeton est faux, sans créer de compte', async () => {
    const { app, db } = setup();
    const res = await supertest(app).post('/api/auth/setup').send(body('wrong-token'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('auth.setup_token_invalid');
    expect((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(0);
  });

  it('retourne 400 si le mot de passe est trop court ou le corps incomplet', async () => {
    const { app, token } = setup();
    const short = await supertest(app)
      .post('/api/auth/setup')
      .send(body(token, { password: 'abc' }));
    expect(short.status).toBe(400);
    const empty = await supertest(app).post('/api/auth/setup').send({});
    expect(empty.status).toBe(400);
  });

  it('retourne 429 après trop de jetons erronés, même avec le bon jeton ensuite', async () => {
    const { app, token } = setup();
    for (let i = 0; i < 10; i++) {
      await supertest(app).post('/api/auth/setup').send(body('wrong'));
    }
    const res = await supertest(app).post('/api/auth/setup').send(body(token));
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('auth.too_many_attempts');
  });
});
