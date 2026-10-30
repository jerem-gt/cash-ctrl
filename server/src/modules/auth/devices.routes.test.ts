import { createHash } from 'node:crypto';

import bcrypt from 'bcrypt';
import * as OTPAuth from 'otpauth';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDb } from '../../tests/helpers/testDb.js';

type Db = ReturnType<typeof createTestDb>;
type App = ReturnType<typeof createApp>;

const DAY = 24 * 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';

/** Base et compte de chaque secret de test, pour que `codeFor` oublie le dernier pas accepté. */
const owners = new WeakMap<OTPAuth.Secret, { db: Db; username: string }>();

function setup(secureCookies = false) {
  const db = createTestDb();
  const app = createApp(db, { secureCookies });
  const hash = bcrypt.hashSync('password123', 4);
  const secrets: Record<string, OTPAuth.Secret> = {};
  for (const [name, admin] of [
    ['alice', 0],
    ['bob', 0],
    ['root', 1],
  ] as const) {
    const secret = new OTPAuth.Secret();
    secrets[name] = secret;
    owners.set(secret, { db, username: name });
    db.prepare(
      'INSERT INTO users (username, password_hash, is_admin, totp_secret, totp_enabled) VALUES (?, ?, ?, ?, 1)',
    ).run(name, hash, admin, secret.base32);
  }
  return { db, app, secrets };
}

/** Code courant ; le dernier pas accepté est oublié (anti-rejeu), pour se reconnecter dans un même test. */
function codeFor(secret: OTPAuth.Secret): string {
  const owner = owners.get(secret);
  owner?.db
    .prepare('UPDATE users SET totp_last_step = NULL WHERE username = ?')
    .run(owner.username);
  return new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  }).generate();
}

function idOf(db: Db, username: string): number {
  return (db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number }).id;
}

function deviceCount(db: Db, username?: string): number {
  if (username === undefined) {
    return (db.prepare('SELECT COUNT(*) AS n FROM trusted_devices').get() as { n: number }).n;
  }
  return (
    db
      .prepare('SELECT COUNT(*) AS n FROM trusted_devices WHERE user_id = ?')
      .get(idOf(db, username)) as { n: number }
  ).n;
}

function setCookies(res: { headers: Record<string, unknown> }): string[] {
  return (res.headers['set-cookie'] as string[] | undefined) ?? [];
}

function deviceSetCookie(res: { headers: Record<string, unknown> }): string | undefined {
  return setCookies(res).find((c) => c.startsWith('cashctrl_device='));
}

/** Valeur brute `cashctrl_device=<jeton>` extraite d'un Set-Cookie. */
function deviceCookieValue(res: { headers: Record<string, unknown> }): string {
  const header = deviceSetCookie(res);
  if (!header) throw new Error('cookie appareil absent');
  return header.split(';')[0];
}

/** Login + vérification TOTP avec remember ; retourne le cookie d'appareil. */
async function trustDevice(
  app: App,
  secrets: Record<string, OTPAuth.Secret>,
  username: string,
  previousCookie?: string,
): Promise<string> {
  const agent = supertest.agent(app);
  const loginReq = agent.post('/api/auth/login').set('User-Agent', UA);
  await (previousCookie ? loginReq.set('Cookie', previousCookie) : loginReq).send({
    username,
    password: 'password123',
  });
  const verifyReq = agent.post('/api/auth/2fa/verify').set('User-Agent', UA);
  const res = await (previousCookie ? verifyReq.set('Cookie', previousCookie) : verifyReq).send({
    code: codeFor(secrets[username]),
    remember: true,
  });
  expect(res.status).toBe(200);
  return deviceCookieValue(res);
}

function login(app: App, username: string, cookie?: string) {
  const req = supertest(app).post('/api/auth/login');
  return (cookie ? req.set('Cookie', cookie) : req).send({ username, password: 'password123' });
}

/** Agent connecté (2FA franchie) sans mémoriser d'appareil, éventuellement avec un cookie d'appareil. */
async function sessionAgent(
  app: App,
  secrets: Record<string, OTPAuth.Secret>,
  username: string,
  deviceCookie?: string,
) {
  const agent = supertest.agent(app);
  await agent.post('/api/auth/login').send({ username, password: 'password123' });
  await agent.post('/api/auth/2fa/verify').send({ code: codeFor(secrets[username]) });
  return {
    get: (url: string) =>
      deviceCookie ? agent.get(url).set('Cookie', deviceCookie) : agent.get(url),
    del: (url: string) =>
      deviceCookie ? agent.delete(url).set('Cookie', deviceCookie) : agent.delete(url),
    agent,
  };
}

describe('POST /api/auth/2fa/verify (remember)', () => {
  it('ne mémorise rien par défaut', async () => {
    const { app, db, secrets } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent
      .post('/api/auth/2fa/verify')
      .send({ code: codeFor(secrets.alice), remember: false });
    expect(res.status).toBe(200);
    expect(deviceSetCookie(res)).toBeUndefined();
    expect(deviceCount(db)).toBe(0);
  });

  it("pose le cookie d'appareil avec les bons attributs et ne stocke que l'empreinte", async () => {
    const { app, db, secrets } = setup();
    const agent = supertest.agent(app);
    await agent
      .post('/api/auth/login')
      .set('User-Agent', UA)
      .send({ username: 'alice', password: 'password123' });
    const res = await agent
      .post('/api/auth/2fa/verify')
      .set('User-Agent', UA)
      .send({ code: codeFor(secrets.alice), remember: true });
    const header = deviceSetCookie(res) as string;
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/api/auth');
    expect(header).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    expect(header).not.toContain('Secure');

    const token = decodeURIComponent(header.split(';')[0].split('=')[1]);
    expect(token).toMatch(/^[\w-]{43}$/);
    const row = db.prepare('SELECT * FROM trusted_devices').get() as {
      token_hash: string;
      label: string;
      user_id: number;
      created_at: number;
      expires_at: number;
    };
    expect(row.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(row.label).toBe('Firefox · Linux');
    expect(row.user_id).toBe(idOf(db, 'alice'));
    expect(row.expires_at - row.created_at).toBe(30 * DAY);
  });

  it('ajoute Secure quand secureCookies est actif et la requête en HTTPS', async () => {
    const { app, secrets } = setup(true);
    app.set('trust proxy', 1);
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent
      .post('/api/auth/2fa/verify')
      .set('X-Forwarded-Proto', 'https')
      .send({ code: codeFor(secrets.alice), remember: true });
    expect(deviceSetCookie(res)).toContain('Secure');
  });

  it("n'ajoute pas Secure en HTTP même avec secureCookies, comme le cookie de session", async () => {
    const { app, secrets } = setup(true);
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent
      .post('/api/auth/2fa/verify')
      .send({ code: codeFor(secrets.alice), remember: true });
    expect(deviceSetCookie(res)).not.toContain('Secure');
  });

  it('ne mémorise pas si le code est invalide', async () => {
    const { app, db } = setup();
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const res = await agent.post('/api/auth/2fa/verify').send({ code: '000000', remember: true });
    expect(res.status).toBe(401);
    expect(deviceSetCookie(res)).toBeUndefined();
    expect(deviceCount(db)).toBe(0);
  });

  it("remplace l'appareil déjà porté par le cookie, même d'un autre compte", async () => {
    const { app, db, secrets } = setup();
    const bobCookie = await trustDevice(app, secrets, 'bob');
    expect(deviceCount(db, 'bob')).toBe(1);

    const aliceCookie = await trustDevice(app, secrets, 'alice', bobCookie);
    expect(aliceCookie).not.toBe(bobCookie);
    expect(deviceCount(db, 'bob')).toBe(0);
    expect(deviceCount(db, 'alice')).toBe(1);
  });

  it('purge les appareils expirés à la création', async () => {
    const { app, db, secrets } = setup();
    db.prepare(
      'INSERT INTO trusted_devices (user_id, token_hash, label, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(idOf(db, 'bob'), 'old', 'x', 1, 1, Date.now() - 1000);
    await trustDevice(app, secrets, 'alice');
    expect(deviceCount(db, 'bob')).toBe(0);
  });
});

describe('POST /api/auth/login avec appareil mémorisé', () => {
  it('ouvre la session sans TOTP et met à jour last_used_at', async () => {
    const { app, db, secrets } = setup();
    const cookie = await trustDevice(app, secrets, 'alice');
    db.prepare('UPDATE trusted_devices SET last_used_at = 1').run();

    const res = await login(app, 'alice', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'alice', totpEnabled: true });
    expect(res.body.totp_required).toBeUndefined();
    const row = db.prepare('SELECT last_used_at FROM trusted_devices').get() as {
      last_used_at: number;
    };
    expect(row.last_used_at).toBeGreaterThan(1);
  });

  it('remet à zéro le compteur du limiteur', async () => {
    const { app, secrets } = setup();
    const cookie = await trustDevice(app, secrets, 'alice');
    for (let i = 0; i < 5; i++) {
      await supertest(app).post('/api/auth/login').send({ username: 'alice', password: 'wrong' });
    }
    expect((await login(app, 'alice', cookie)).status).toBe(200);
    for (let i = 0; i < 9; i++) {
      await supertest(app).post('/api/auth/login').send({ username: 'alice', password: 'wrong' });
    }
    expect((await login(app, 'alice', cookie)).status).toBe(200);
  });

  it('garde le TOTP si le mot de passe est faux', async () => {
    const { app, secrets } = setup();
    const cookie = await trustDevice(app, secrets, 'alice');
    const res = await supertest(app)
      .post('/api/auth/login')
      .set('Cookie', cookie)
      .send({ username: 'alice', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('demande le TOTP et efface le cookie si l’appareil est expiré', async () => {
    const { app, db, secrets } = setup();
    const cookie = await trustDevice(app, secrets, 'alice');
    db.prepare('UPDATE trusted_devices SET expires_at = ?').run(Date.now() - 1);

    const res = await login(app, 'alice', cookie);
    expect(res.body).toEqual({ totp_required: true });
    const cleared = deviceSetCookie(res) as string;
    expect(cleared).toContain('cashctrl_device=;');
    expect(cleared).toContain('Path=/api/auth');
    expect(deviceCount(db)).toBe(0);
  });

  it('demande le TOTP et efface le cookie si l’appareil est révoqué', async () => {
    const { app, db, secrets } = setup();
    const cookie = await trustDevice(app, secrets, 'alice');
    db.prepare('DELETE FROM trusted_devices').run();

    const res = await login(app, 'alice', cookie);
    expect(res.body).toEqual({ totp_required: true });
    expect(deviceSetCookie(res)).toContain('cashctrl_device=;');
  });

  it('demande le TOTP et efface un cookie inconnu', async () => {
    const { app } = setup();
    const res = await login(app, 'alice', 'cashctrl_device=garbage');
    expect(res.body).toEqual({ totp_required: true });
    expect(deviceSetCookie(res)).toContain('cashctrl_device=;');
  });

  it('demande le TOTP sans effacer ni supprimer l’appareil d’un autre compte', async () => {
    const { app, db, secrets } = setup();
    const bobCookie = await trustDevice(app, secrets, 'bob');

    const res = await login(app, 'alice', bobCookie);
    expect(res.body).toEqual({ totp_required: true });
    expect(deviceSetCookie(res)).toBeUndefined();
    expect(deviceCount(db, 'bob')).toBe(1);
    expect((await login(app, 'bob', bobCookie)).body.totp_required).toBeUndefined();
  });

  it('ne touche ni appareils ni cookie à la déconnexion', async () => {
    const { app, db, secrets } = setup();
    const cookie = await trustDevice(app, secrets, 'alice');
    const res = await supertest(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(deviceSetCookie(res)).toBeUndefined();
    expect(deviceCount(db, 'alice')).toBe(1);
  });
});

describe('routes /api/auth/devices', () => {
  it('exige une session', async () => {
    const { app } = setup();
    expect((await supertest(app).get('/api/auth/devices')).status).toBe(401);
    expect((await supertest(app).delete('/api/auth/devices')).status).toBe(401);
    expect((await supertest(app).delete('/api/auth/devices/1')).status).toBe(401);
  });

  it('liste les appareils non expirés du compte, triés, avec current', async () => {
    const { app, db, secrets } = setup();
    const other = await trustDevice(app, secrets, 'alice');
    const current = await trustDevice(app, secrets, 'alice');
    await trustDevice(app, secrets, 'bob');
    const aliceId = idOf(db, 'alice');
    db.prepare(
      'INSERT INTO trusted_devices (user_id, token_hash, label, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(aliceId, 'expired', 'Vieux', 1, 1, Date.now() - 1000);
    db.prepare('UPDATE trusted_devices SET last_used_at = ? WHERE token_hash = ?').run(
      5,
      createHash('sha256')
        .update(decodeURIComponent(other.split('=')[1]))
        .digest('hex'),
    );

    const s = await sessionAgent(app, secrets, 'alice', current);
    const res = await s.get('/api/auth/devices');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({
      id: expect.any(Number),
      label: 'Firefox · Linux',
      created_at: expect.any(Number),
      last_used_at: expect.any(Number),
      expires_at: expect.any(Number),
      current: true,
    });
    expect(res.body[1].current).toBe(false);
    expect(res.body[0].last_used_at).toBeGreaterThanOrEqual(res.body[1].last_used_at);
    expect(res.body[0]).not.toHaveProperty('token_hash');
  });

  it('current est faux sans cookie correspondant', async () => {
    const { app, secrets } = setup();
    await trustDevice(app, secrets, 'alice');
    const s = await sessionAgent(app, secrets, 'alice');
    const res = await s.get('/api/auth/devices');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].current).toBe(false);
  });

  it('oublie un appareil du compte sans effacer le cookie si ce n’est pas le courant', async () => {
    const { app, db, secrets } = setup();
    const cookie = await trustDevice(app, secrets, 'alice');
    const s = await sessionAgent(app, secrets, 'alice');
    const id = (db.prepare('SELECT id FROM trusted_devices').get() as { id: number }).id;
    const res = await s.del(`/api/auth/devices/${id}`);
    expect(res.status).toBe(200);
    expect(deviceSetCookie(res)).toBeUndefined();
    expect(deviceCount(db)).toBe(0);
    expect((await login(app, 'alice', cookie)).body).toEqual({ totp_required: true });
  });

  it('efface aussi le cookie quand l’appareil oublié est le courant', async () => {
    const { app, db, secrets } = setup();
    const cookie = await trustDevice(app, secrets, 'alice');
    const s = await sessionAgent(app, secrets, 'alice', cookie);
    const id = (db.prepare('SELECT id FROM trusted_devices').get() as { id: number }).id;
    const res = await s.del(`/api/auth/devices/${id}`);
    expect(res.status).toBe(200);
    expect(deviceSetCookie(res)).toContain('cashctrl_device=;');
  });

  it('retourne 404 pour un appareil inconnu ou d’un autre compte', async () => {
    const { app, db, secrets } = setup();
    await trustDevice(app, secrets, 'bob');
    const s = await sessionAgent(app, secrets, 'alice');
    const bobDevice = (db.prepare('SELECT id FROM trusted_devices').get() as { id: number }).id;
    const res = await s.del(`/api/auth/devices/${bobDevice}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('auth.device_not_found');
    expect((await s.del('/api/auth/devices/9999')).status).toBe(404);
    expect(deviceCount(db, 'bob')).toBe(1);
  });

  it('oublie tous les appareils du compte, efface le cookie et garde la session', async () => {
    const { app, db, secrets } = setup();
    const cookie = await trustDevice(app, secrets, 'alice');
    await trustDevice(app, secrets, 'alice');
    await trustDevice(app, secrets, 'bob');
    const s = await sessionAgent(app, secrets, 'alice', cookie);
    const res = await s.del('/api/auth/devices');
    expect(res.status).toBe(200);
    expect(deviceSetCookie(res)).toContain('cashctrl_device=;');
    expect(deviceCount(db, 'alice')).toBe(0);
    expect(deviceCount(db, 'bob')).toBe(1);
    expect((await s.agent.get('/api/auth/me')).status).toBe(200);
  });

  it('oublier tous ne touche pas au cookie valide d’un autre compte', async () => {
    const { app, db, secrets } = setup();
    const bobCookie = await trustDevice(app, secrets, 'bob');
    const s = await sessionAgent(app, secrets, 'alice', bobCookie);
    const res = await s.del('/api/auth/devices');
    expect(res.status).toBe(200);
    expect(deviceSetCookie(res)).toBeUndefined();
    expect(deviceCount(db, 'bob')).toBe(1);
    expect((await login(app, 'bob', bobCookie)).body).not.toEqual({ totp_required: true });
  });
});

describe('révocation des appareils', () => {
  function resetToken(db: Db, userId: number): string {
    const token = 'reset-token-value';
    db.prepare(
      'INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    ).run(createHash('sha256').update(token).digest('hex'), userId, Date.now() + 60_000);
    return token;
  }

  it('POST /change-password', async () => {
    const { app, db, secrets } = setup();
    await trustDevice(app, secrets, 'alice');
    await trustDevice(app, secrets, 'bob');
    const s = await sessionAgent(app, secrets, 'alice');
    const res = await s.agent
      .post('/api/auth/change-password')
      .send({ current: 'password123', next: 'newpassword1' });
    expect(res.status).toBe(200);
    expect(deviceCount(db, 'alice')).toBe(0);
    expect(deviceCount(db, 'bob')).toBe(1);
  });

  it('POST /password/reset', async () => {
    const { app, db, secrets } = setup();
    await trustDevice(app, secrets, 'alice');
    await trustDevice(app, secrets, 'bob');
    const token = resetToken(db, idOf(db, 'alice'));
    const res = await supertest(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'newpassword1' });
    expect(res.status).toBe(200);
    expect(deviceCount(db, 'alice')).toBe(0);
    expect(deviceCount(db, 'bob')).toBe(1);
  });

  it('PATCH /api/users/:id avec mot de passe (autre compte et propre compte)', async () => {
    const { app, db, secrets } = setup();
    await trustDevice(app, secrets, 'alice');
    await trustDevice(app, secrets, 'root');
    const s = await sessionAgent(app, secrets, 'root');

    const other = await s.agent
      .patch(`/api/users/${idOf(db, 'alice')}`)
      .send({ password: 'newpassword1' });
    expect(other.status).toBe(200);
    expect(deviceCount(db, 'alice')).toBe(0);
    expect(deviceCount(db, 'root')).toBe(1);

    const own = await s.agent
      .patch(`/api/users/${idOf(db, 'root')}`)
      .send({ password: 'newpassword2' });
    expect(own.status).toBe(200);
    expect(deviceCount(db, 'root')).toBe(0);
  });

  it('PATCH /api/users/:id sans mot de passe ne révoque rien', async () => {
    const { app, db, secrets } = setup();
    await trustDevice(app, secrets, 'alice');
    const s = await sessionAgent(app, secrets, 'root');
    const res = await s.agent
      .patch(`/api/users/${idOf(db, 'alice')}`)
      .send({ username: 'alicia', email: 'alicia@test.fr' });
    expect(res.status).toBe(200);
    expect(deviceCount(db)).toBe(1);
  });

  it('PATCH /profile (nom, e-mail) ne révoque rien', async () => {
    const { app, db, secrets } = setup();
    await trustDevice(app, secrets, 'alice');
    const s = await sessionAgent(app, secrets, 'alice');
    const res = await s.agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', username: 'alicia', email: 'a@test.fr' });
    expect(res.status).toBe(200);
    expect(deviceCount(db)).toBe(1);
  });

  it('POST /2fa/disable', async () => {
    const { app, db, secrets } = setup();
    await trustDevice(app, secrets, 'alice');
    await trustDevice(app, secrets, 'bob');
    const s = await sessionAgent(app, secrets, 'alice');
    const res = await s.agent.post('/api/auth/2fa/disable').send({ password: 'password123' });
    expect(res.status).toBe(200);
    expect(deviceCount(db, 'alice')).toBe(0);
    expect(deviceCount(db, 'bob')).toBe(1);
  });

  it('POST /2fa/enable (réactivation)', async () => {
    const { app, db } = setup();
    const aliceId = idOf(db, 'alice');
    db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(aliceId);
    db.prepare(
      'INSERT INTO trusted_devices (user_id, token_hash, label, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(aliceId, 'stale', 'x', 1, 1, Date.now() + DAY);
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const { secret } = (await agent.post('/api/auth/2fa/setup')).body as { secret: string };
    const res = await agent
      .post('/api/auth/2fa/enable')
      .send({ code: codeFor(OTPAuth.Secret.fromBase32(secret)) });
    expect(res.status).toBe(200);
    expect(deviceCount(db, 'alice')).toBe(0);
  });

  it('DELETE /api/users/:id/2fa', async () => {
    const { app, db, secrets } = setup();
    await trustDevice(app, secrets, 'alice');
    await trustDevice(app, secrets, 'bob');
    const s = await sessionAgent(app, secrets, 'root');
    const res = await s.agent.delete(`/api/users/${idOf(db, 'alice')}/2fa`);
    expect(res.status).toBe(200);
    expect(deviceCount(db, 'alice')).toBe(0);
    expect(deviceCount(db, 'bob')).toBe(1);
  });

  it('la suppression du compte supprime ses appareils (cascade)', async () => {
    const { app, db, secrets } = setup();
    await trustDevice(app, secrets, 'alice');
    const s = await sessionAgent(app, secrets, 'root');
    const res = await s.agent.delete(`/api/users/${idOf(db, 'alice')}`);
    expect(res.status).toBe(200);
    expect(deviceCount(db)).toBe(0);
  });
});
