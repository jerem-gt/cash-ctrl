import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDb } from '../../tests/helpers/testDb.js';

function setup(backupDir?: string) {
  const db = createTestDb();
  const app = createApp(db, { backupDir });
  const hash = bcrypt.hashSync('password123', 4);
  db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)').run(
    'admin',
    hash,
  );
  db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)').run(
    'alice',
    hash,
  );
  return { db, app };
}

function idOf(db: ReturnType<typeof createTestDb>, username: string): number {
  return (db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number }).id;
}

async function loginAs(app: ReturnType<typeof createApp>, username: string) {
  const agent = supertest.agent(app);
  await agent.post('/api/auth/login').send({ username, password: 'password123' });
  return agent;
}

describe('GET /api/users', () => {
  it('retourne la liste des utilisateurs si admin', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).not.toHaveProperty('password_hash');
    expect(Object.keys(res.body.items[0])).toEqual(
      expect.arrayContaining(['id', 'username', 'email', 'isAdmin', 'totpEnabled', 'createdAt']),
    );
  });

  it('retourne 403 si non admin', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'alice');
    const res = await agent.get('/api/users');
    expect(res.status).toBe(403);
  });

  it('retourne 401 sans session', async () => {
    const { app } = setup();
    const res = await supertest(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users', () => {
  it('crée un utilisateur si admin', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.post('/api/users').send({ username: 'bob', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('bob');
    expect(res.body.isAdmin).toBe(false);
  });

  it('seed les données statiques du nouvel utilisateur (défaut FR)', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'admin');
    await agent.post('/api/users').send({ username: 'bob', password: 'password123' });
    const bob = db.prepare('SELECT id FROM users WHERE username = ?').get('bob') as { id: number };
    const atCount = (
      db.prepare('SELECT COUNT(*) as n FROM account_types WHERE user_id = ?').get(bob.id) as {
        n: number;
      }
    ).n;
    const catCount = (
      db.prepare('SELECT COUNT(*) as n FROM categories WHERE user_id = ?').get(bob.id) as {
        n: number;
      }
    ).n;
    const pmCount = (
      db.prepare('SELECT COUNT(*) as n FROM payment_methods WHERE user_id = ?').get(bob.id) as {
        n: number;
      }
    ).n;
    expect(atCount).toBeGreaterThan(0);
    expect(catCount).toBeGreaterThan(0);
    expect(pmCount).toBeGreaterThan(0);

    // FR libellés par défaut
    const catFr = db
      .prepare("SELECT id FROM categories WHERE user_id = ? AND name = 'Revenus financiers'")
      .get(bob.id) as { id: number } | undefined;
    expect(catFr).toBeDefined();

    // Les 6 system refs doivent être peuplées
    const settings = db
      .prepare('SELECT financial_income_category_id FROM user_settings WHERE user_id = ?')
      .get(bob.id) as { financial_income_category_id: number | null } | undefined;
    expect(settings?.financial_income_category_id).not.toBeNull();
  });

  it('seed les données en anglais quand lang=en', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent
      .post('/api/users')
      .send({ username: 'charlie', password: 'password123', lang: 'en' });
    expect(res.status).toBe(201);
    const charlie = db.prepare('SELECT id FROM users WHERE username = ?').get('charlie') as {
      id: number;
    };

    // EN libellés
    const catEn = db
      .prepare("SELECT id FROM categories WHERE user_id = ? AND name = 'Financial income'")
      .get(charlie.id) as { id: number } | undefined;
    expect(catEn).toBeDefined();

    // Les system refs doivent pointer sur la catégorie EN
    const settings = db
      .prepare('SELECT financial_income_category_id FROM user_settings WHERE user_id = ?')
      .get(charlie.id) as { financial_income_category_id: number | null } | undefined;
    expect(settings?.financial_income_category_id).toBe(catEn?.id);
  });

  it('retourne 400 si lang est invalide', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent
      .post('/api/users')
      .send({ username: 'dave', password: 'password123', lang: 'de' });
    expect(res.status).toBe(400);
  });

  it('retourne 409 si le username est déjà pris', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.post('/api/users').send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('retourne 400 si le mot de passe est trop court', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.post('/api/users').send({ username: 'bob', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('retourne 403 si non admin', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'alice');
    const res = await agent.post('/api/users').send({ username: 'bob', password: 'password123' });
    expect(res.status).toBe(403);
  });

  it('enregistre l’e-mail facultatif (normalisé)', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent
      .post('/api/users')
      .send({ username: 'bob', password: 'password123', email: 'Bob@Test.fr' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('bob@test.fr');
  });

  it('retourne 409 user.email_taken et 400 si e-mail invalide', async () => {
    const { app, db } = setup();
    db.prepare("UPDATE users SET email = 'alice@test.fr' WHERE username = 'alice'").run();
    const agent = await loginAs(app, 'admin');
    const taken = await agent
      .post('/api/users')
      .send({ username: 'bob', password: 'password123', email: 'ALICE@test.fr' });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('user.email_taken');
    const bad = await agent
      .post('/api/users')
      .send({ username: 'bob', password: 'password123', email: 'nope' });
    expect(bad.status).toBe(400);
  });
});

describe('PATCH /api/users/:id', () => {
  it('modifie le username si admin', async () => {
    const { app, db } = setup();
    const alice = db.prepare('SELECT id FROM users WHERE username = ?').get('alice') as {
      id: number;
    };
    const agent = await loginAs(app, 'admin');
    const res = await agent.patch(`/api/users/${alice.id}`).send({ username: 'alicia' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alicia');
  });

  it('modifie l’e-mail (normalisé) puis l’efface avec null', async () => {
    const { app, db } = setup();
    const alice = idOf(db, 'alice');
    const agent = await loginAs(app, 'admin');
    const res = await agent.patch(`/api/users/${alice}`).send({ email: ' Alice@Test.FR ' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@test.fr');
    const cleared = await agent.patch(`/api/users/${alice}`).send({ email: null });
    expect(cleared.body.email).toBeNull();
  });

  it('retourne 409 user.email_taken si l’e-mail est déjà utilisé (insensible à la casse)', async () => {
    const { app, db } = setup();
    db.prepare("UPDATE users SET email = 'bob@test.fr' WHERE username = 'admin'").run();
    const agent = await loginAs(app, 'admin');
    const res = await agent.patch(`/api/users/${idOf(db, 'alice')}`).send({ email: 'BOB@test.fr' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('user.email_taken');
  });

  it('retourne 400 pour un e-mail invalide, un corps vide ou is_admin non booléen', async () => {
    const { app, db } = setup();
    const alice = idOf(db, 'alice');
    const agent = await loginAs(app, 'admin');
    expect((await agent.patch(`/api/users/${alice}`).send({ email: 'nope' })).status).toBe(400);
    expect((await agent.patch(`/api/users/${alice}`).send({})).status).toBe(400);
    expect((await agent.patch(`/api/users/${alice}`).send({ isAdmin: 'yes' })).status).toBe(400);
  });

  it('promeut un utilisateur admin, qui accède alors à /api/users sans reconnexion', async () => {
    const { app, db } = setup();
    const alice = await loginAs(app, 'alice');
    expect((await alice.get('/api/users')).status).toBe(403);
    const admin = await loginAs(app, 'admin');
    const res = await admin.patch(`/api/users/${idOf(db, 'alice')}`).send({ isAdmin: true });
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
    expect((await alice.get('/api/users')).status).toBe(200);
  });

  it('un admin rétrogradé perd ses droits immédiatement (session déjà ouverte)', async () => {
    const { app, db } = setup();
    const admin = await loginAs(app, 'admin');
    db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'alice'").run();
    const alice = await loginAs(app, 'alice');
    expect((await alice.get('/api/users')).status).toBe(200);
    const res = await admin.patch(`/api/users/${idOf(db, 'alice')}`).send({ isAdmin: false });
    expect(res.status).toBe(200);
    expect((await alice.get('/api/users')).status).toBe(403);
  });

  it('retourne 409 user.last_admin en rétrogradant le dernier admin', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.patch(`/api/users/${idOf(db, 'admin')}`).send({ isAdmin: false });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('user.last_admin');
  });

  it('permet de se rétrograder s’il reste un autre admin', async () => {
    const { app, db } = setup();
    db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'alice'").run();
    const agent = await loginAs(app, 'admin');
    const res = await agent.patch(`/api/users/${idOf(db, 'admin')}`).send({ isAdmin: false });
    expect(res.status).toBe(200);
  });

  it('deux admins qui se rétrogradent l’un l’autre en même temps en laissent un', async () => {
    const { app, db } = setup();
    db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'alice'").run();
    const admin = await loginAs(app, 'admin');
    const alice = await loginAs(app, 'alice');

    // Le mot de passe impose un hachage asynchrone entre la vérification et l'écriture.
    const results = await Promise.all([
      admin
        .patch(`/api/users/${idOf(db, 'alice')}`)
        .send({ isAdmin: false, password: 'brandnewpass1' }),
      alice
        .patch(`/api/users/${idOf(db, 'admin')}`)
        .send({ isAdmin: false, password: 'brandnewpass1' }),
    ]);

    expect(results.map((res) => res.status).sort((a, b) => a - b)).toEqual([200, 409]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get()).toEqual({
      n: 1,
    });
  }, 20_000);

  it('redéfinir le mot de passe d’un autre compte ferme toutes ses sessions', async () => {
    const { app, db } = setup();
    const alice1 = await loginAs(app, 'alice');
    const alice2 = await loginAs(app, 'alice');
    const admin = await loginAs(app, 'admin');
    const res = await admin
      .patch(`/api/users/${idOf(db, 'alice')}`)
      .send({ password: 'brandnewpass1' });
    expect(res.status).toBe(200);
    expect((await alice1.get('/api/auth/me')).status).toBe(401);
    expect((await alice2.get('/api/auth/me')).status).toBe(401);
    expect((await admin.get('/api/auth/me')).status).toBe(200);
  });

  it('redéfinir son propre mot de passe ferme ses autres sessions et garde la courante', async () => {
    const { app, db } = setup();
    const other = await loginAs(app, 'admin');
    const current = await loginAs(app, 'admin');
    const res = await current
      .patch(`/api/users/${idOf(db, 'admin')}`)
      .send({ password: 'brandnewpass1' });
    expect(res.status).toBe(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
    expect((await current.get('/api/auth/me')).status).toBe(200);
  });

  it('autorise un admin à renvoyer son propre nom sans conflit', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.patch(`/api/users/${idOf(db, 'admin')}`).send({ username: 'admin' });
    expect(res.status).toBe(200);
  });

  it('retourne 404 si utilisateur introuvable', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.patch('/api/users/9999').send({ username: 'ghost' });
    expect(res.status).toBe(404);
  });

  it('retourne 409 si le nouveau username est déjà pris', async () => {
    const { app, db } = setup();
    const hash = bcrypt.hashSync('password123', 4);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('bob', hash);
    const alice = db.prepare('SELECT id FROM users WHERE username = ?').get('alice') as {
      id: number;
    };
    const agent = await loginAs(app, 'admin');
    const res = await agent.patch(`/api/users/${alice.id}`).send({ username: 'bob' });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/users/:id', () => {
  it('supprime un utilisateur non admin si admin', async () => {
    const { app, db } = setup();
    const alice = db.prepare('SELECT id FROM users WHERE username = ?').get('alice') as {
      id: number;
    };
    const agent = await loginAs(app, 'admin');
    const res = await agent.delete(`/api/users/${alice.id}`);
    expect(res.status).toBe(204);
  });

  it('retourne 404 si utilisateur introuvable', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.delete('/api/users/9999');
    expect(res.status).toBe(404);
  });

  it('retourne 409 user.cannot_delete_self pour son propre compte', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.delete(`/api/users/${idOf(db, 'admin')}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('user.cannot_delete_self');
  });

  it('supprime un autre admin s’il en reste un, et ferme ses sessions', async () => {
    const { app, db } = setup();
    db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'alice'").run();
    const alice = await loginAs(app, 'alice');
    const admin = await loginAs(app, 'admin');
    const res = await admin.delete(`/api/users/${idOf(db, 'alice')}`);
    expect(res.status).toBe(204);
    expect((await alice.get('/api/auth/me')).status).toBe(401);
  });

  it('ferme les sessions de l’utilisateur supprimé', async () => {
    const { app, db } = setup();
    const alice = await loginAs(app, 'alice');
    const admin = await loginAs(app, 'admin');
    await admin.delete(`/api/users/${idOf(db, 'alice')}`);
    expect((await alice.get('/api/auth/me')).status).toBe(401);
  });
});

describe('DELETE /api/users/:id/2fa', () => {
  it('désactive la 2FA du compte', async () => {
    const { app, db } = setup();
    db.prepare(
      "UPDATE users SET totp_secret = 'JBSWY3DPEHPK3PXP', totp_enabled = 1 WHERE username = 'alice'",
    ).run();
    const agent = await loginAs(app, 'admin');
    const res = await agent.delete(`/api/users/${idOf(db, 'alice')}/2fa`);
    expect(res.status).toBe(204);
    const row = db
      .prepare("SELECT totp_enabled, totp_secret FROM users WHERE username = 'alice'")
      .get();
    expect(row).toEqual({ totp_enabled: 0, totp_secret: null });
  });

  it('retourne 409 auth.totp_not_enabled si la 2FA n’est pas activée', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.delete(`/api/users/${idOf(db, 'alice')}/2fa`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('auth.totp_not_enabled');
  });

  it('retourne 404 si inconnu et 403 si non admin', async () => {
    const { app, db } = setup();
    const admin = await loginAs(app, 'admin');
    expect((await admin.delete('/api/users/9999/2fa')).status).toBe(404);
    const alice = await loginAs(app, 'alice');
    expect((await alice.delete(`/api/users/${idOf(db, 'admin')}/2fa`)).status).toBe(403);
  });
});

describe('DELETE /api/users/:id : fichiers du compte', () => {
  it('efface les sauvegardes du compte supprimé, pas celles des autres', async () => {
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cash-users-'));
    try {
      const { app, db } = setup(backupDir);
      const aliceDir = path.join(backupDir, String(idOf(db, 'alice')));
      const adminDir = path.join(backupDir, String(idOf(db, 'admin')));
      for (const dir of [aliceDir, adminDir]) {
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, 'cashctrl-backup.json'), '{}');
      }
      const agent = await loginAs(app, 'admin');
      expect((await agent.delete(`/api/users/${idOf(db, 'alice')}`)).status).toBe(204);
      expect(fs.existsSync(aliceDir)).toBe(false);
      expect(fs.existsSync(adminDir)).toBe(true);
    } finally {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  });
});
