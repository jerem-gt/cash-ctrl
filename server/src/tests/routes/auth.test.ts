import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../app.js';
import { createTestDb } from '../helpers/testDb';

function setup() {
  const db = createTestDb();
  const app = createApp(db);
  const hash = bcrypt.hashSync('password123', 4);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('alice', hash);
  return { db, app };
}

describe('POST /api/auth/login', () => {
  it('returns 200 + username on valid credentials', async () => {
    const { app } = setup();
    const res = await supertest(app).post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
  });

  it('returns 401 on wrong password', async () => {
    const { app } = setup();
    const res = await supertest(app).post('/api/auth/login').send({ username: 'alice', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown user', async () => {
    const { app } = setup();
    const res = await supertest(app).post('/api/auth/login').send({ username: 'nobody', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is missing', async () => {
    const { app } = setup();
    const res = await supertest(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without session', async () => {
    const { app } = setup();
    const res = await supertest(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns username when authenticated', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
  });
});

describe('POST /api/auth/logout', () => {
  it('destroys the session and returns ok', async () => {
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
  it('changes the password when current is correct', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent.post('/api/auth/change-password').send({ current: 'password123', next: 'newpassword456' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 401 when current password is wrong', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent.post('/api/auth/change-password').send({ current: 'wrongpass', next: 'newpassword456' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when new password is too short', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent.post('/api/auth/change-password').send({ current: 'password123', next: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without session', async () => {
    const { app } = setup();
    const res = await supertest(app).post('/api/auth/change-password').send({ current: 'password123', next: 'newpassword456' });
    expect(res.status).toBe(401);
  });
});
