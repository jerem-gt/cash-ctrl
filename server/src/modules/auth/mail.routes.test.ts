import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { createFakeMailer } from '../../tests/helpers/fakeMailer.js';
import { createTestDb } from '../../tests/helpers/testDb.js';

function setup(opts: { mailer?: ReturnType<typeof createFakeMailer> } = {}) {
  const db = createTestDb();
  const mailer = opts.mailer ?? createFakeMailer();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const app = createApp(db, { mailer, authLogger: log });
  const hash = bcrypt.hashSync('password123', 4);
  db.prepare(
    'INSERT INTO users (username, password_hash, email, is_admin) VALUES (?, ?, ?, 1)',
  ).run('alice', hash, 'alice@test.fr');
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('noemail', hash);
  return { db, app, mailer, log };
}

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
    expect(res.status).toBe(204);
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
