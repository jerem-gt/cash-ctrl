import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { TEST_PASS, TEST_USER } from '../../tests/helpers/testApp.js';
import { createTestDb, seedTestReferenceData } from '../../tests/helpers/testDb.js';

function createTestContextWithBackupDir(backupDir: string) {
  const db = createTestDb();
  const app = createApp(db, { backupDir });
  const agent = supertest.agent(app);
  const hash = bcrypt.hashSync(TEST_PASS, 4);
  const userId = Number(
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(TEST_USER, hash)
      .lastInsertRowid,
  );
  seedTestReferenceData(db, userId);
  return { db, app, agent, userId };
}

describe('/api/backup', () => {
  let tmpDir: string;
  let ctx: ReturnType<typeof createTestContextWithBackupDir>;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cashctrl-routes-'));
    ctx = createTestContextWithBackupDir(tmpDir);
    await ctx.agent.post('/api/auth/login').send({ username: TEST_USER, password: TEST_PASS });
  });

  describe('GET /list', () => {
    it('retourne 401 sans authentification', async () => {
      expect((await supertest(ctx.app).get('/api/backup/list')).status).toBe(401);
    });

    it('retourne un tableau vide si aucun backup', async () => {
      const res = await ctx.agent.get('/api/backup/list');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('retourne la liste des backups présents', async () => {
      fs.writeFileSync(path.join(tmpDir, 'cashctrl-backup-2026-01-01T00-00-00.json'), '{}');
      const res = await ctx.agent.get('/api/backup/list');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].filename).toBe('cashctrl-backup-2026-01-01T00-00-00.json');
    });
  });

  describe('POST /run', () => {
    it('retourne 401 sans authentification', async () => {
      expect((await supertest(ctx.app).post('/api/backup/run')).status).toBe(401);
    });

    it('crée un backup et retourne 201 avec skipped=false (premier run)', async () => {
      const res = await ctx.agent.post('/api/backup/run');
      expect(res.status).toBe(201);
      expect(res.body.skipped).toBe(false);
      expect(res.body.filename).toMatch(/^cashctrl-backup-/);
      expect(fs.existsSync(path.join(tmpDir, res.body.filename as string))).toBe(true);
    });

    it('retourne 200 avec skipped=true si les données sont inchangées', async () => {
      await ctx.agent.post('/api/backup/run'); // premier backup
      const res = await ctx.agent.post('/api/backup/run'); // mêmes données
      expect(res.status).toBe(200);
      expect(res.body.skipped).toBe(true);
      expect(res.body.filename).toBeNull();
    });

    it('respecte backup_max_files lors de la rotation', async () => {
      await ctx.agent.put('/api/settings').send({
        lead_days: 30,
        backup_enabled: false,
        backup_frequency_h: 24,
        backup_max_files: 1,
      });
      await ctx.agent.post('/api/backup/run'); // premier backup
      // Modifier les données pour forcer un deuxième backup
      ctx.db
        .prepare(
          'INSERT INTO accounts (user_id, name, bank_id, account_type_id) VALUES (?, ?, 1, 1)',
        )
        .run(ctx.userId, 'Compte rotation test');
      await ctx.agent.post('/api/backup/run');
      const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith('cashctrl-backup-'));
      expect(files).toHaveLength(1);
    });
  });

  describe('GET /:filename', () => {
    it('retourne 401 sans authentification', async () => {
      expect(
        (await supertest(ctx.app).get('/api/backup/cashctrl-backup-2026-01-01T00-00-00.json'))
          .status,
      ).toBe(401);
    });

    it('retourne 400 si le nom de fichier ne correspond pas au pattern', async () => {
      expect((await ctx.agent.get('/api/backup/malicious.json')).status).toBe(400);
    });

    it("retourne 404 si le fichier n'existe pas", async () => {
      expect(
        (await ctx.agent.get('/api/backup/cashctrl-backup-9999-01-01T00-00-00.json')).status,
      ).toBe(404);
    });

    it("télécharge le fichier s'il existe", async () => {
      const filename = 'cashctrl-backup-2026-05-14T10-30-00.json';
      fs.writeFileSync(path.join(tmpDir, filename), JSON.stringify({ version: '1.0' }));
      const res = await ctx.agent.get(`/api/backup/${filename}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain(filename);
    });
  });
});
