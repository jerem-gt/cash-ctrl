import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDb } from '../../tests/helpers/testDb.js';

function setup() {
  const db = createTestDb();
  const app = createApp(db);
  const hash = bcrypt.hashSync('password123', 4);
  db.prepare('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)').run(
    'alice',
    hash,
    'alice@test.fr',
  );
  db.prepare('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)').run(
    'bob',
    hash,
    'bob@test.fr',
  );
  return { db, app };
}

async function loginAlice(app: ReturnType<typeof createApp>) {
  const agent = supertest.agent(app);
  await agent.post('/api/auth/login').send({ username: 'alice', password: 'password123' });
  return agent;
}

describe('GET /api/auth/me', () => {
  it('expose l’e-mail (ou null)', async () => {
    const { app, db } = setup();
    const agent = await loginAlice(app);
    expect((await agent.get('/api/auth/me')).body.email).toBe('alice@test.fr');
    db.prepare("UPDATE users SET email = NULL WHERE username = 'alice'").run();
    expect((await agent.get('/api/auth/me')).body.email).toBeNull();
  });
});

describe('PATCH /api/auth/profile', () => {
  it('modifie le nom et met à jour la session', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    const res = await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', username: 'alicia' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: expect.any(Number),
      username: 'alicia',
      email: 'alice@test.fr',
      isAdmin: false,
      totpEnabled: false,
    });
    expect((await agent.get('/api/auth/me')).body.username).toBe('alicia');
  });

  it('normalise l’e-mail (trim + minuscules)', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    const res = await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', email: '  New.Alice@Test.FR ' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('new.alice@test.fr');
  });

  it('efface l’e-mail avec null', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    const res = await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', email: null });
    expect(res.status).toBe(200);
    expect(res.body.email).toBeNull();
  });

  it('conserve les autres sessions', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    const other = await loginAlice(app);
    await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', username: 'alicia' });
    expect((await other.get('/api/auth/me')).status).toBe(200);
  });

  it('accepte de renvoyer son propre nom ou son propre e-mail (casse différente)', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    const res = await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', username: 'alice', email: 'ALICE@test.fr' });
    expect(res.status).toBe(200);
  });

  it('retourne 401 si le mot de passe actuel est faux', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    const res = await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'wrong', username: 'alicia' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('auth.current_password_incorrect');
  });

  it('retourne 409 si le nom est pris', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    const res = await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', username: 'bob' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('user.username_taken');
  });

  it('retourne 409 si l’e-mail est pris (insensible à la casse)', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    const res = await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', email: 'BOB@test.fr' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('user.email_taken');
  });

  it('retourne 400 pour un e-mail invalide, un corps sans champ ou sans mot de passe', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    const bad = await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', email: 'pas-un-email' });
    expect(bad.status).toBe(400);
    const none = await agent.patch('/api/auth/profile').send({ current_password: 'password123' });
    expect(none.status).toBe(400);
    const noPwd = await agent.patch('/api/auth/profile').send({ username: 'x' });
    expect(noPwd.status).toBe(400);
  });

  it('retourne 401 sans session', async () => {
    const { app } = setup();
    const res = await supertest(app)
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', username: 'x' });
    expect(res.status).toBe(401);
  });

  it('retourne 429 après trop d’échecs du mot de passe actuel, même avec le bon ensuite', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    for (let i = 0; i < 10; i++) {
      await agent.patch('/api/auth/profile').send({ current_password: 'wrong', username: 'x' });
    }
    const res = await agent
      .patch('/api/auth/profile')
      .send({ current_password: 'password123', username: 'alicia' });
    expect(res.status).toBe(429);
  });
});

describe('limitation partagée du mot de passe actuel', () => {
  it('change-password est bloqué (429) après 10 échecs, avec reset au succès', async () => {
    const { app } = setup();
    const agent = await loginAlice(app);
    for (let i = 0; i < 9; i++) {
      await agent
        .post('/api/auth/change-password')
        .send({ current: 'wrong', next: 'newpassword1' });
    }
    // Un succès remet le compteur à zéro
    const ok = await agent
      .post('/api/auth/change-password')
      .send({ current: 'password123', next: 'password123' });
    expect(ok.status).toBe(200);
    for (let i = 0; i < 10; i++) {
      await agent
        .post('/api/auth/change-password')
        .send({ current: 'wrong', next: 'newpassword1' });
    }
    const blocked = await agent
      .post('/api/auth/change-password')
      .send({ current: 'password123', next: 'newpassword1' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('auth.too_many_attempts');
    // 10 bcrypt.compare au coût de prod (12) après le changement : lent en CI chargée
  }, 20_000);

  it('2fa/disable est bloqué (429) après 10 mots de passe faux', async () => {
    const { app, db } = setup();
    const agent = await loginAlice(app);
    // 2FA activée après le login pour éviter le flux TOTP
    db.prepare(
      "UPDATE users SET totp_secret = 'JBSWY3DPEHPK3PXP', totp_enabled = 1 WHERE username = 'alice'",
    ).run();
    for (let i = 0; i < 10; i++) {
      await agent.post('/api/auth/2fa/disable').send({ password: 'wrong' });
    }
    const res = await agent.post('/api/auth/2fa/disable').send({ password: 'password123' });
    expect(res.status).toBe(429);
  });
});
