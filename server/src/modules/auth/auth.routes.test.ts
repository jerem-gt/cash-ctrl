import bcrypt from 'bcrypt';
import * as OTPAuth from 'otpauth';
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

function makeTotp(secret: string) {
  return new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

describe('POST /api/auth/login', () => {
  it('retourne 200, le nom utilisateur et isAdmin si les identifiants sont valides', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    expect(res.body.isAdmin).toBe(false);
    expect(res.body.totpEnabled).toBe(false);
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

  it('retourne 429 après trop de tentatives échouées', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    for (let i = 0; i < 10; i++) {
      await agent.post('/api/auth/login').send({ username: 'alice', password: 'wrong' });
    }
    // 11e tentative bloquée, même avec les bons identifiants
    const res = await agent
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(429);
  });

  it('retourne totp_required et pending_token si la 2FA est activée', async () => {
    const { app, db } = setup();
    const secret = new OTPAuth.Secret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?').run(
      secret.base32,
      'alice',
    );
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.totp_required).toBe(true);
    expect(typeof res.body.pending_token).toBe('string');
  });
});

describe('GET /api/auth/me', () => {
  it('retourne 401 sans session', async () => {
    const { app } = setup();
    const res = await supertest(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('retourne le nom utilisateur, isAdmin et totpEnabled si authentifié', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    expect(res.body.isAdmin).toBe(false);
    expect(res.body.totpEnabled).toBe(false);
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

describe('POST /api/auth/2fa/setup', () => {
  it("retourne l'URI et le secret si l'utilisateur est connecté sans 2FA", async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent.post('/api/auth/2fa/setup');
    expect(res.status).toBe(200);
    expect(typeof res.body.uri).toBe('string');
    expect(res.body.uri).toContain('otpauth://totp/');
    expect(typeof res.body.secret).toBe('string');
  });

  it('retourne 409 si la 2FA est déjà activée', async () => {
    const { app, db } = setup();
    const secret = new OTPAuth.Secret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?').run(
      secret.base32,
      'alice',
    );
    const agent = supertest.agent(app);
    // login via verifyTotp car 2FA activée
    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    const code = makeTotp(secret.base32).generate();
    await agent
      .post('/api/auth/2fa/verify')
      .send({ pending_token: loginRes.body.pending_token, code });
    const res = await agent.post('/api/auth/2fa/setup');
    expect(res.status).toBe(409);
  });

  it('retourne 401 sans session', async () => {
    const { app } = setup();
    const res = await supertest(app).post('/api/auth/2fa/setup');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/2fa/enable', () => {
  it('active la 2FA si le code est valide', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const setupRes = await agent.post('/api/auth/2fa/setup');
    const { secret } = setupRes.body as { secret: string };
    const code = makeTotp(secret).generate();
    const res = await agent.post('/api/auth/2fa/enable').send({ secret, code });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('retourne 401 si le code est invalide', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const setupRes = await agent.post('/api/auth/2fa/setup');
    const { secret } = setupRes.body as { secret: string };
    const res = await agent.post('/api/auth/2fa/enable').send({ secret, code: '000000' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/2fa/disable', () => {
  it('désactive la 2FA si le mot de passe est correct', async () => {
    const { app, db } = setup();
    const secret = new OTPAuth.Secret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?').run(
      secret.base32,
      'alice',
    );
    const agent = supertest.agent(app);
    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    const code = makeTotp(secret.base32).generate();
    await agent
      .post('/api/auth/2fa/verify')
      .send({ pending_token: loginRes.body.pending_token, code });
    const res = await agent.post('/api/auth/2fa/disable').send({ password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('retourne 401 si le mot de passe est incorrect', async () => {
    const { app, db } = setup();
    const secret = new OTPAuth.Secret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?').run(
      secret.base32,
      'alice',
    );
    const agent = supertest.agent(app);
    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    const code = makeTotp(secret.base32).generate();
    await agent
      .post('/api/auth/2fa/verify')
      .send({ pending_token: loginRes.body.pending_token, code });
    const res = await agent.post('/api/auth/2fa/disable').send({ password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/2fa/verify', () => {
  it('crée la session si le code est valide', async () => {
    const { app, db } = setup();
    const secret = new OTPAuth.Secret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?').run(
      secret.base32,
      'alice',
    );
    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    const code = makeTotp(secret.base32).generate();
    const agent = supertest.agent(app);
    const res = await agent
      .post('/api/auth/2fa/verify')
      .send({ pending_token: loginRes.body.pending_token, code });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    // La session est bien créée
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
  });

  it('retourne 401 si le code est invalide', async () => {
    const { app, db } = setup();
    const secret = new OTPAuth.Secret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?').run(
      secret.base32,
      'alice',
    );
    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    const res = await supertest(app)
      .post('/api/auth/2fa/verify')
      .send({ pending_token: loginRes.body.pending_token, code: '000000' });
    expect(res.status).toBe(401);
  });

  it('retourne 401 si le token est invalide', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/2fa/verify')
      .send({ pending_token: 'bad-token', code: '123456' });
    expect(res.status).toBe(401);
  });
});
