import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDb } from '../../tests/helpers/testDb';

function setup() {
  const db = createTestDb();
  const app = createApp(db);
  const hash = bcrypt.hashSync('password123', 4);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('alice', hash);
  return { db, app };
}

describe('POST /api/auth/login', () => {
  it('retourne 200 et le nom utilisateur si les identifiants sont valides', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
  });

  it('retourne 401 si le mot de passe est incorrect', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it("retourne 401 si l'utilisateur est inconnu", async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('retourne 400 si le corps de la requête est vide', async () => {
    const { app } = setup();
    const res = await supertest(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('retourne 401 sans session', async () => {
    const { app } = setup();
    const res = await supertest(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('retourne le nom utilisateur si authentifié', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
  });
});

describe('POST /api/auth/logout', () => {
  it('détruit la session et retourne ok', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it("modifie le mot de passe si l'ancien est correct", async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent
      .post('/api/auth/change-password')
      .send({ current: 'password123', next: 'newpassword456' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("retourne 401 si l'ancien mot de passe est incorrect", async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent
      .post('/api/auth/change-password')
      .send({ current: 'wrongpass', next: 'newpassword456' });
    expect(res.status).toBe(401);
  });

  it('retourne 400 si le nouveau mot de passe est trop court', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent
      .post('/api/auth/change-password')
      .send({ current: 'password123', next: 'short' });
    expect(res.status).toBe(400);
  });

  it('retourne 401 sans session', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/change-password')
      .send({ current: 'password123', next: 'newpassword456' });
    expect(res.status).toBe(401);
  });
});
