import { createHmac } from 'node:crypto';

import bcrypt from 'bcrypt';
import * as OTPAuth from 'otpauth';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDb } from '../../tests/helpers/testDb.js';

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

/** Cookie `connect.sid` signé (secret de test) pointant vers un sid donné. */
function signedSidCookie(sid: string): string {
  // SHA-256 = 32 octets → base64 de 44 caractères dont un '=' final à retirer.
  const sig = createHmac('sha256', 'test-secret').update(sid).digest('base64').slice(0, -1);
  const signed = 's:' + sid + '.' + sig;
  return 'connect.sid=' + encodeURIComponent(signed);
}

function sessionExists(db: ReturnType<typeof createTestDb>, sid: string): boolean {
  return db.prepare('SELECT 1 FROM sessions WHERE sid = ?').get(sid) !== undefined;
}

function sidFromSetCookie(res: { headers: Record<string, unknown> }): string {
  const [first] = res.headers['set-cookie'] as string[];
  const value = decodeURIComponent(first.split(';')[0].split('=')[1]);
  return value.slice(2, value.lastIndexOf('.'));
}

/** Active la 2FA sur alice et retourne un agent avec session TOTP en attente. */
async function setupTotpAgent(
  app: ReturnType<typeof createApp>,
  db: ReturnType<typeof createTestDb>,
) {
  const secret = new OTPAuth.Secret();
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?').run(
    secret.base32,
    'alice',
  );
  const agent = supertest.agent(app);
  await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
  return { agent, secret };
}

describe('POST /api/auth/login', () => {
  it('retourne 200, le nom utilisateur et isAdmin si les identifiants sont valides', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.id).toEqual(expect.any(Number));
    expect(res.body.username).toBe('alice');
    expect(res.body.isAdmin).toBe(false);
    expect(res.body.totpEnabled).toBe(false);
  });

  it("régénère l'id de session au login (anti-fixation)", async () => {
    const { app, db } = setup();
    db.prepare('INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)').run(
      'fixed-sid',
      JSON.stringify({ cookie: { originalMaxAge: 60_000 } }),
      Date.now() + 60_000,
    );
    const res = await supertest(app)
      .post('/api/auth/login')
      .set('Cookie', signedSidCookie('fixed-sid'))
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(sidFromSetCookie(res)).not.toBe('fixed-sid');
    expect(sessionExists(db, 'fixed-sid')).toBe(false);
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

  it('retourne 400 pour un corps de formulaire, même avec des identifiants valides (anti-CSRF)', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/login')
      .type('form')
      .send({ username: 'alice', password: 'password123' });
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

  it('retourne totp_required si la 2FA est activée', async () => {
    const { app, db } = setup();
    const { agent } = await setupTotpAgent(app, db);
    const res = await agent
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.totp_required).toBe(true);
    expect(res.body.pending_token).toBeUndefined();
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
    expect(res.body.id).toEqual(expect.any(Number));
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

  it('invalide les autres sessions du user mais garde la courante et celles des autres', async () => {
    const { app, db } = setup();
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
      'bob',
      bcrypt.hashSync('password123', 4),
    );
    const creds = { username: 'alice', password: 'password123' };
    const current = supertest.agent(app);
    const other = supertest.agent(app);
    const bob = supertest.agent(app);
    await current.post('/api/auth/login').send(creds);
    await other.post('/api/auth/login').send(creds);
    await bob.post('/api/auth/login').send({ username: 'bob', password: 'password123' });

    const res = await current
      .post('/api/auth/change-password')
      .send({ current: 'password123', next: 'newpassword456' });
    expect(res.status).toBe(200);

    expect((await current.get('/api/auth/me')).status).toBe(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
    expect((await bob.get('/api/auth/me')).status).toBe(200);
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
    const { agent, secret } = await setupTotpAgent(app, db);
    const code = makeTotp(secret.base32).generate();
    await agent.post('/api/auth/2fa/verify').send({ code });
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
    const res = await agent.post('/api/auth/2fa/enable').send({ code });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('ignore un secret envoyé par le client : seul celui de la session compte', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    await agent.post('/api/auth/2fa/setup');
    const own = new OTPAuth.Secret().base32;
    // Le code d'un autre secret ne vaut rien (sauf collision improbable de 6 chiffres).
    const res = await agent
      .post('/api/auth/2fa/enable')
      .send({ secret: own, code: makeTotp(own).generate() });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('auth.totp_invalid');
  });

  it('retourne 400 sans secret proposé par /2fa/setup', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent.post('/api/auth/2fa/enable').send({ code: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('auth.totp_setup_expired');
  });

  it('le code de confirmation ne sert pas à se connecter', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const { secret } = (await agent.post('/api/auth/2fa/setup')).body as { secret: string };
    const code = makeTotp(secret).generate();
    await agent.post('/api/auth/2fa/enable').send({ code });

    const other = supertest.agent(app);
    await other.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await other.post('/api/auth/2fa/verify').send({ code });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('auth.totp_invalid');
  });

  it('retourne 401 si le code est invalide', async () => {
    const { app } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const setupRes = await agent.post('/api/auth/2fa/setup');
    const { secret } = setupRes.body as { secret: string };
    const wrong = makeTotp(secret).generate() === '000000' ? '111111' : '000000';
    const res = await agent.post('/api/auth/2fa/enable').send({ code: wrong });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/2fa/disable', () => {
  it('désactive la 2FA si le mot de passe est correct', async () => {
    const { app, db } = setup();
    const { agent, secret } = await setupTotpAgent(app, db);
    const code = makeTotp(secret.base32).generate();
    await agent.post('/api/auth/2fa/verify').send({ code });
    const res = await agent.post('/api/auth/2fa/disable').send({ password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('retourne 401 si le mot de passe est incorrect', async () => {
    const { app, db } = setup();
    const { agent, secret } = await setupTotpAgent(app, db);
    const code = makeTotp(secret.base32).generate();
    await agent.post('/api/auth/2fa/verify').send({ code });
    const res = await agent.post('/api/auth/2fa/disable').send({ password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/2fa/verify', () => {
  it('crée la session si le code est valide', async () => {
    const { app, db } = setup();
    const { agent, secret } = await setupTotpAgent(app, db);
    const code = makeTotp(secret.base32).generate();
    const res = await agent.post('/api/auth/2fa/verify').send({ code });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
  });

  it("régénère l'id de session après vérification (anti-fixation)", async () => {
    const { app, db } = setup();
    const secret = new OTPAuth.Secret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?').run(
      secret.base32,
      'alice',
    );
    const login = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    const pendingSid = sidFromSetCookie(login);
    expect(sessionExists(db, pendingSid)).toBe(true);

    const res = await supertest(app)
      .post('/api/auth/2fa/verify')
      .set('Cookie', signedSidCookie(pendingSid))
      .send({ code: makeTotp(secret.base32).generate() });
    expect(res.status).toBe(200);
    expect(sidFromSetCookie(res)).not.toBe(pendingSid);
    expect(sessionExists(db, pendingSid)).toBe(false);
  });

  it('retourne 401 si le code est invalide', async () => {
    const { app, db } = setup();
    const { agent } = await setupTotpAgent(app, db);
    const res = await agent.post('/api/auth/2fa/verify').send({ code: '000000' });
    expect(res.status).toBe(401);
  });

  it('refuse un code déjà utilisé (anti-rejeu)', async () => {
    const { app, db } = setup();
    const { agent, secret } = await setupTotpAgent(app, db);
    const code = makeTotp(secret.base32).generate();
    expect((await agent.post('/api/auth/2fa/verify').send({ code })).status).toBe(200);

    const second = supertest.agent(app);
    await second.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await second.post('/api/auth/2fa/verify').send({ code });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('auth.totp_invalid');
  });

  it('accepte le code suivant après un code utilisé', async () => {
    const { app, db } = setup();
    const { agent, secret } = await setupTotpAgent(app, db);
    const totp = makeTotp(secret.base32);
    await agent.post('/api/auth/2fa/verify').send({ code: totp.generate() });

    const second = supertest.agent(app);
    await second.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const next = totp.generate({ timestamp: Date.now() + 30_000 });
    expect((await second.post('/api/auth/2fa/verify').send({ code: next })).status).toBe(200);
  });

  it('bloque le compte après 10 codes faux, même depuis des adresses différentes', async () => {
    const { app, db } = setup();
    app.set('trust proxy', true);
    const { secret } = await setupTotpAgent(app, db);
    const clientIp = (n: number) => `10.0.0.${n}`;
    for (let i = 0; i < 10; i++) {
      const agent = supertest.agent(app);
      await agent
        .post('/api/auth/login')
        .set('X-Forwarded-For', clientIp(i))
        .send({ username: 'alice', password: 'password123' });
      await agent
        .post('/api/auth/2fa/verify')
        .set('X-Forwarded-For', clientIp(i))
        .send({ code: 'abcdef' });
    }
    const agent = supertest.agent(app);
    await agent
      .post('/api/auth/login')
      .set('X-Forwarded-For', clientIp(99))
      .send({ username: 'alice', password: 'password123' });
    const res = await agent
      .post('/api/auth/2fa/verify')
      .set('X-Forwarded-For', clientIp(99))
      .send({ code: makeTotp(secret.base32).generate() });
    expect(res.status).toBe(429);
  });

  it('retourne 401 sans session TOTP en attente', async () => {
    const { app } = setup();
    const res = await supertest(app).post('/api/auth/2fa/verify').send({ code: '123456' });
    expect(res.status).toBe(401);
  });

  it('retourne 429 après trop de codes TOTP invalides', async () => {
    const { app, db } = setup();
    const { agent } = await setupTotpAgent(app, db);
    for (let i = 0; i < 10; i++) {
      await agent.post('/api/auth/2fa/verify').send({ code: '000000' });
    }
    const res = await agent.post('/api/auth/2fa/verify').send({ code: '000000' });
    expect(res.status).toBe(429);
  });

  it('les échecs TOTP épuisent aussi le quota de /login', async () => {
    const { app, db } = setup();
    const { agent } = await setupTotpAgent(app, db);
    for (let i = 0; i < 10; i++) {
      await agent.post('/api/auth/2fa/verify').send({ code: '000000' });
    }
    const res = await agent
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(429);
  });
});
