import { createHash } from 'node:crypto';

import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { createFakeMailer } from '../../tests/helpers/fakeMailer.js';
import { createTestDb } from '../../tests/helpers/testDb.js';

interface Opts {
  mailer?: ReturnType<typeof createFakeMailer>;
  appUrl?: string;
}

function setup(opts: Opts = {}) {
  const db = createTestDb();
  const mailer = opts.mailer ?? createFakeMailer();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const app = createApp(db, { mailer, appUrl: opts.appUrl, authLogger: log });
  const hash = bcrypt.hashSync('password123', 4);
  db.prepare(
    'INSERT INTO users (username, password_hash, email, is_admin) VALUES (?, ?, ?, 1)',
  ).run('alice', hash, 'alice@test.fr');
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('noemail', hash);
  return { db, app, mailer, log };
}

function tokenCount(db: ReturnType<typeof createTestDb>): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM password_reset_tokens').get() as { n: number }).n;
}

function tokenFrom(text: string): string {
  return /token=([\w-]+)/.exec(text)?.[1] as string;
}

describe('POST /api/auth/password/forgot', () => {
  it('envoie l’e-mail avec un lien basé sur APP_URL (fr par défaut)', async () => {
    const { app, db, mailer } = setup({ appUrl: 'https://cash.example.com' });
    const res = await supertest(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: 'alice' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe('alice@test.fr');
    expect(mailer.sent[0].text).toContain('https://cash.example.com/reset-password?token=');
    expect(mailer.sent[0].subject).toContain('réinitialisation');
    // Seule l'empreinte est stockée
    const token = tokenFrom(mailer.sent[0].text);
    const row = db.prepare('SELECT token_hash, expires_at FROM password_reset_tokens').get() as {
      token_hash: string;
      expires_at: number;
    };
    expect(row.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(row.expires_at).toBeGreaterThan(Date.now() + 29 * 60_000);
    expect(row.expires_at).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
  });

  it('accepte l’e-mail comme identifiant (insensible à la casse) et la langue en', async () => {
    const { app, mailer } = setup({ appUrl: 'https://cash.example.com/' });
    const res = await supertest(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: 'ALICE@test.fr', lang: 'en' });
    expect(res.status).toBe(200);
    expect(mailer.sent[0].subject).toContain('password reset');
    // Slash final d'APP_URL retiré
    expect(mailer.sent[0].text).toContain('https://cash.example.com/reset-password?token=');
  });

  it('remplace les anciens jetons du compte', async () => {
    const { app, db } = setup({ appUrl: 'https://x.test' });
    await supertest(app).post('/api/auth/password/forgot').send({ identifier: 'alice' });
    await supertest(app).post('/api/auth/password/forgot').send({ identifier: 'alice' });
    expect(tokenCount(db)).toBe(1);
  });

  it('purge les jetons expirés', async () => {
    const { app, db } = setup({ appUrl: 'https://x.test' });
    const bob = db.prepare("SELECT id FROM users WHERE username = 'noemail'").get() as {
      id: number;
    };
    db.prepare('INSERT INTO password_reset_tokens VALUES (?, ?, ?)').run(
      'old',
      bob.id,
      Date.now() - 1,
    );
    await supertest(app).post('/api/auth/password/forgot').send({ identifier: 'alice' });
    expect(
      db.prepare("SELECT 1 FROM password_reset_tokens WHERE token_hash = 'old'").get(),
    ).toBeUndefined();
  });

  it('écrit le lien dans les logs (chemin relatif) sans APP_URL, sans envoyer d’e-mail', async () => {
    const { app, mailer, log } = setup();
    const res = await supertest(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: 'alice' });
    expect(res.status).toBe(200);
    expect(mailer.sent).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.warn.mock.calls[0][0]).toMatch(/ \/reset-password\?token=[\w-]+/);
  });

  it('écrit le lien absolu dans les logs si l’utilisateur n’a pas d’e-mail', async () => {
    const { app, mailer, log } = setup({ appUrl: 'https://x.test' });
    await supertest(app).post('/api/auth/password/forgot').send({ identifier: 'noemail' });
    expect(mailer.sent).toHaveLength(0);
    expect(log.warn.mock.calls[0][0]).toContain('https://x.test/reset-password?token=');
  });

  it('écrit le lien dans les logs si le mailer n’est pas configuré', async () => {
    const { app, mailer, log } = setup({
      appUrl: 'https://x.test',
      mailer: createFakeMailer({ configured: false }),
    });
    await supertest(app).post('/api/auth/password/forgot').send({ identifier: 'alice' });
    expect(mailer.sent).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('répond 200 même si l’envoi échoue (erreur loguée)', async () => {
    const { app, log } = setup({
      appUrl: 'https://x.test',
      mailer: createFakeMailer({ fail: true }),
    });
    const res = await supertest(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: 'alice' });
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(log.error).toHaveBeenCalled());
  });

  it('répond 200 pour un compte inconnu, sans jeton ni e-mail', async () => {
    const { app, db, mailer } = setup({ appUrl: 'https://x.test' });
    const res = await supertest(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: 'ghost' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(tokenCount(db)).toBe(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it('retourne 400 si le corps est invalide', async () => {
    const { app } = setup();
    const res = await supertest(app).post('/api/auth/password/forgot').send({});
    expect(res.status).toBe(400);
  });

  it('retourne 429 au-delà de 5 requêtes par IP', async () => {
    const { app } = setup();
    for (let i = 0; i < 5; i++) {
      const ok = await supertest(app)
        .post('/api/auth/password/forgot')
        .send({ identifier: 'ghost' });
      expect(ok.status).toBe(200);
    }
    const res = await supertest(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: 'ghost' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('auth.too_many_attempts');
  });
});

describe('POST /api/auth/password/reset', () => {
  async function requestToken(
    app: ReturnType<typeof createApp>,
    mailer: { sent: { text: string }[] },
  ) {
    await supertest(app).post('/api/auth/password/forgot').send({ identifier: 'alice' });
    return tokenFrom(mailer.sent.at(-1)?.text ?? '');
  }

  it('change le mot de passe, supprime les jetons et ferme toutes les sessions', async () => {
    const { app, db, mailer } = setup({ appUrl: 'https://x.test' });
    const s1 = supertest.agent(app);
    const s2 = supertest.agent(app);
    await s1.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    await s2.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
    const token = await requestToken(app, mailer);

    const res = await supertest(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'brandnewpass1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(tokenCount(db)).toBe(0);
    expect((await s1.get('/api/auth/me')).status).toBe(401);
    expect((await s2.get('/api/auth/me')).status).toBe(401);

    const login = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'brandnewpass1' });
    expect(login.status).toBe(200);
  });

  it('ne touche pas à la 2FA', async () => {
    const { app, db, mailer } = setup({ appUrl: 'https://x.test' });
    db.prepare(
      "UPDATE users SET totp_secret = 'JBSWY3DPEHPK3PXP', totp_enabled = 1 WHERE username = 'alice'",
    ).run();
    const token = await requestToken(app, mailer);
    await supertest(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'brandnewpass1' });
    const row = db.prepare("SELECT totp_enabled FROM users WHERE username = 'alice'").get() as {
      totp_enabled: number;
    };
    expect(row.totp_enabled).toBe(1);
  });

  it('refuse un jeton déjà utilisé (400 reset_token_invalid)', async () => {
    const { app, mailer } = setup({ appUrl: 'https://x.test' });
    const token = await requestToken(app, mailer);
    await supertest(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'brandnewpass1' });
    const res = await supertest(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'anotherpass12' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('auth.reset_token_invalid');
  });

  it('refuse un jeton expiré', async () => {
    const { app, db, mailer } = setup({ appUrl: 'https://x.test' });
    const token = await requestToken(app, mailer);
    db.prepare('UPDATE password_reset_tokens SET expires_at = ?').run(Date.now() - 1000);
    const res = await supertest(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'brandnewpass1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('auth.reset_token_invalid');
  });

  it('refuse un jeton inconnu', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/password/reset')
      .send({ token: 'inconnu', password: 'brandnewpass1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('auth.reset_token_invalid');
  });

  it('retourne 400 de validation si le mot de passe est trop court', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .post('/api/auth/password/reset')
      .send({ token: 'x', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation.invalid');
  });

  it('retourne 429 après trop de jetons invalides', async () => {
    const { app } = setup();
    for (let i = 0; i < 10; i++) {
      await supertest(app)
        .post('/api/auth/password/reset')
        .send({ token: 'x', password: 'brandnewpass1' });
    }
    const res = await supertest(app)
      .post('/api/auth/password/reset')
      .send({ token: 'x', password: 'brandnewpass1' });
    expect(res.status).toBe(429);
  });
});

describe('POST /api/auth/test-email', () => {
  async function loginAs(app: ReturnType<typeof createApp>, username: string) {
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ username, password: 'password123' });
    return agent;
  }

  it('envoie un e-mail de test à l’adresse du compte courant', async () => {
    const { app, mailer } = setup();
    const agent = await loginAs(app, 'alice');
    const res = await agent.post('/api/auth/test-email');
    expect(res.status).toBe(200);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe('alice@test.fr');
  });

  it('retourne 400 auth.email_missing sans e-mail', async () => {
    const { app, db } = setup();
    db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'noemail'").run();
    const agent = await loginAs(app, 'noemail');
    const res = await agent.post('/api/auth/test-email');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('auth.email_missing');
  });

  it('retourne 503 auth.smtp_not_configured si le mailer n’est pas configuré', async () => {
    const { app } = setup({ mailer: createFakeMailer({ configured: false }) });
    const agent = await loginAs(app, 'alice');
    const res = await agent.post('/api/auth/test-email');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('auth.smtp_not_configured');
  });

  it('retourne 502 auth.email_send_failed si l’envoi échoue', async () => {
    const { app } = setup({ mailer: createFakeMailer({ fail: true }) });
    const agent = await loginAs(app, 'alice');
    const res = await agent.post('/api/auth/test-email');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('auth.email_send_failed');
  });

  it('retourne 403 pour un non-admin et sans session', async () => {
    const { app, db } = setup();
    db.prepare("UPDATE users SET is_admin = 0 WHERE username = 'alice'").run();
    const agent = await loginAs(app, 'alice');
    expect((await agent.post('/api/auth/test-email')).status).toBe(403);
    expect((await supertest(app).post('/api/auth/test-email')).status).toBe(401);
  });
});
