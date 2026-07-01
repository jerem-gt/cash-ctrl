/* eslint-disable sonarjs/no-hardcoded-passwords */
import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDb } from '../../tests/helpers/testDb';

function setup() {
  const db = createTestDb();
  const app = createApp(db);
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
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).not.toHaveProperty('password_hash');
  });

  it('retourne 403 si non admin', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'alice');
    const res = await agent.get('/api/users');
    expect(res.status).toBe(403);
  });

  it('retourne 403 sans session', async () => {
    const { app } = setup();
    const res = await supertest(app).get('/api/users');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/users', () => {
  it('crée un utilisateur si admin', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.post('/api/users').send({ username: 'bob', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('bob');
    expect(res.body.is_admin).toBe(0);
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

  it('retourne 403 si on tente de modifier le compte admin', async () => {
    const { app, db } = setup();
    const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin') as {
      id: number;
    };
    const agent = await loginAs(app, 'admin');
    const res = await agent.patch(`/api/users/${admin.id}`).send({ username: 'hacked' });
    expect(res.status).toBe(403);
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
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('retourne 403 si on tente de supprimer le compte admin', async () => {
    const { app, db } = setup();
    const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin') as {
      id: number;
    };
    const agent = await loginAs(app, 'admin');
    const res = await agent.delete(`/api/users/${admin.id}`);
    expect(res.status).toBe(403);
  });

  it('retourne 404 si utilisateur introuvable', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'admin');
    const res = await agent.delete('/api/users/9999');
    expect(res.status).toBe(404);
  });
});
