import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SetupToken } from '@jerem-gt/ctrl-shared/server/setup';
import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import supertest from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { createFakeMailer } from '../../tests/helpers/fakeMailer.js';
import { createTestDb, setupFixtures } from '../../tests/helpers/testDb.js';

// Comptes et authentification viennent du module de ctrl-shared, testé là-bas : ici, ce qui est
// propre à CashCtrl (langues, données initiales, e-mails, statistiques, sauvegardes, cookie).

const PASSWORD = 'password123';

function addUser(
  db: Database,
  username: string,
  { isAdmin = false, email = null as string | null } = {},
) {
  return Number(
    db
      .prepare('INSERT INTO users (username, password_hash, email, is_admin) VALUES (?, ?, ?, ?)')
      .run(username, bcrypt.hashSync(PASSWORD, 4), email, isAdmin ? 1 : 0).lastInsertRowid,
  );
}

function setup(options: Parameters<typeof createApp>[1] = {}) {
  const db = createTestDb();
  const mailer = createFakeMailer();
  const app = createApp(db, {
    mailer,
    authLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...options,
  });
  return { db, app, mailer };
}

async function loginAs(app: ReturnType<typeof createApp>, username: string) {
  const agent = supertest.agent(app);
  await agent.post('/api/auth/login').send({ username, password: PASSWORD });
  return agent;
}

const hasCategory = (db: Database, userId: number, name: string) =>
  db.prepare('SELECT 1 FROM categories WHERE user_id = ? AND name = ?').get(userId, name) !==
  undefined;

describe('données initiales d’un compte', () => {
  it('le premier compte est créé dans la langue demandée', async () => {
    const setupToken = new SetupToken();
    const { app, db } = setup({ setupToken });
    const res = await supertest(app)
      .post('/api/auth/setup')
      .send({ token: setupToken.current(), username: 'jerem', password: PASSWORD, lang: 'en' });
    expect(res.status).toBe(200);
    expect(hasCategory(db, res.body.id, 'Financial income')).toBe(true);
  });

  it.each([
    [undefined, 'Revenus financiers'],
    ['en', 'Financial income'],
  ])('un compte créé par un admin (lang=%s) reçoit ses données', async (lang, category) => {
    const { app, db } = setup();
    addUser(db, 'admin', { isAdmin: true });
    const agent = await loginAs(app, 'admin');
    const res = await agent.post('/api/users').send({ username: 'bob', password: PASSWORD, lang });
    expect(res.status).toBe(201);
    expect(hasCategory(db, res.body.id, category)).toBe(true);
    const settings = db
      .prepare('SELECT financial_income_category_id FROM user_settings WHERE user_id = ?')
      .get(res.body.id) as { financial_income_category_id: number | null };
    expect(settings.financial_income_category_id).not.toBeNull();
  });

  it('refuse une langue inconnue', async () => {
    const { app, db } = setup();
    addUser(db, 'admin', { isAdmin: true });
    const agent = await loginAs(app, 'admin');
    const res = await agent
      .post('/api/users')
      .send({ username: 'bob', password: PASSWORD, lang: 'de' });
    expect(res.status).toBe(400);
  });
});

describe('e-mails', () => {
  it.each([
    [undefined, 'réinitialisation'],
    ['en', 'password reset'],
  ])('mot de passe oublié (lang=%s) : e-mail dans la langue demandée', async (lang, subject) => {
    const { app, db, mailer } = setup({ appUrl: 'https://cash.example.com/' });
    addUser(db, 'alice', { email: 'alice@test.fr' });
    const res = await supertest(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: 'alice', lang });
    expect(res.status).toBe(204);
    expect(mailer.sent[0].subject).toContain(subject);
    // Slash final d'APP_URL retiré.
    expect(mailer.sent[0].text).toContain('https://cash.example.com/reset-password?token=');
  });

  it('l’e-mail de test est bilingue', async () => {
    const { app, db, mailer } = setup();
    addUser(db, 'alice', { isAdmin: true, email: 'alice@test.fr' });
    const agent = await loginAs(app, 'alice');
    expect((await agent.post('/api/auth/test-email')).status).toBe(204);
    expect(mailer.sent[0]).toMatchObject({ to: 'alice@test.fr', subject: 'CashCtrl' });
    expect(mailer.sent[0].text).toContain('CashCtrl fonctionne');
    expect(mailer.sent[0].text).toContain('sending from CashCtrl works');
  });
});

describe('comptes (page Utilisateurs)', () => {
  it('liste les comptes avec leurs comptes bancaires et opérations', async () => {
    const { db } = setupFixtures();
    const app = createApp(db);
    addUser(db, 'admin', { isAdmin: true });
    const agent = await loginAs(app, 'admin');
    const res = await agent.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      expect.objectContaining({
        username: 'test',
        stats: { accountCount: 2, txCount: 0, lastTxDate: null },
      }),
      expect.objectContaining({
        username: 'admin',
        isAdmin: true,
        stats: { accountCount: 0, txCount: 0, lastTxDate: null },
      }),
    ]);
  });

  it('efface les sauvegardes du compte supprimé, pas celles des autres', async () => {
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cash-users-'));
    try {
      const { app, db } = setup({ backupDir });
      const adminId = addUser(db, 'admin', { isAdmin: true });
      const aliceId = addUser(db, 'alice');
      const aliceDir = path.join(backupDir, String(aliceId));
      const adminDir = path.join(backupDir, String(adminId));
      for (const dir of [aliceDir, adminDir]) {
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, 'cashctrl-backup.json'), '{}');
      }
      const agent = await loginAs(app, 'admin');
      expect((await agent.delete(`/api/users/${aliceId}`)).status).toBe(204);
      expect(fs.existsSync(aliceDir)).toBe(false);
      expect(fs.existsSync(adminDir)).toBe(true);
    } finally {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  });
});

describe('session', () => {
  it('garde le nom de cookie d’express-session (sessions ouvertes conservées)', async () => {
    const { app, db } = setup();
    addUser(db, 'alice');
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: PASSWORD });
    expect([res.headers['set-cookie']].flat()[0]).toMatch(/^connect\.sid=/);
  });

  it('protège les routes de l’appli', async () => {
    const { app } = setup();
    const res = await supertest(app).get('/api/accounts');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('common.unauthorized');
  });
});
