import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDb, type Fixtures, setupFixtures } from '../tests/helpers/testDb';
import { listBackups, rotateBackups, runBackup, startBackupInterval } from './backup';

let tmpDir: string;
let fixtures: Fixtures;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cashctrl-backup-test-'));
  fixtures = setupFixtures();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('listBackups', () => {
  it('retourne un tableau vide si le dossier est absent', () => {
    expect(listBackups(path.join(tmpDir, 'nonexistent'))).toEqual([]);
  });

  it('retourne un tableau vide si aucun fichier ne correspond', () => {
    fs.writeFileSync(path.join(tmpDir, 'other.json'), '{}');
    expect(listBackups(tmpDir)).toEqual([]);
  });

  it('retourne les fichiers triés par nom', () => {
    fs.writeFileSync(path.join(tmpDir, 'cashctrl-backup-2026-01-02T12-00-00.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'cashctrl-backup-2026-01-01T08-00-00.json'), '{}');
    const files = listBackups(tmpDir);
    expect(files).toHaveLength(2);
    expect(files[0].filename).toBe('cashctrl-backup-2026-01-01T08-00-00.json');
    expect(files[1].filename).toBe('cashctrl-backup-2026-01-02T12-00-00.json');
  });

  it('retourne la taille et la date de création de chaque fichier', () => {
    const content = JSON.stringify({ test: true });
    fs.writeFileSync(path.join(tmpDir, 'cashctrl-backup-2026-05-14T10-00-00.json'), content);
    const [file] = listBackups(tmpDir);
    expect(file.size).toBe(Buffer.byteLength(content));
    expect(file.created_at).toBe('2026-05-14T10:00:00Z');
  });
});

describe('rotateBackups', () => {
  it('ne supprime rien si le nombre de fichiers <= max', () => {
    fs.writeFileSync(path.join(tmpDir, 'cashctrl-backup-2026-01-01T00-00-00.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'cashctrl-backup-2026-01-02T00-00-00.json'), '{}');
    rotateBackups(3, tmpDir);
    expect(listBackups(tmpDir)).toHaveLength(2);
  });

  it('supprime les fichiers les plus anciens au-delà de max', () => {
    fs.writeFileSync(path.join(tmpDir, 'cashctrl-backup-2026-01-01T00-00-00.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'cashctrl-backup-2026-01-02T00-00-00.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'cashctrl-backup-2026-01-03T00-00-00.json'), '{}');
    rotateBackups(2, tmpDir);
    const remaining = listBackups(tmpDir);
    expect(remaining).toHaveLength(2);
    expect(remaining[0].filename).toBe('cashctrl-backup-2026-01-02T00-00-00.json');
    expect(remaining[1].filename).toBe('cashctrl-backup-2026-01-03T00-00-00.json');
  });
});

describe('runBackup', () => {
  it('crée un fichier JSON lors du premier backup (pas de hash précédent)', () => {
    const result = runBackup(fixtures.db, fixtures.userId, tmpDir);
    expect(result.skipped).toBe(false);
    expect(result.filename).toMatch(/^cashctrl-backup-\d{4}-\d{2}-\d{2}T[\d-]+\.json$/);
    expect(fs.existsSync(path.join(tmpDir, result.filename!))).toBe(true);
  });

  it('le fichier contient une structure FullExport valide', () => {
    const result = runBackup(fixtures.db, fixtures.userId, tmpDir);
    expect(result.skipped).toBe(false);
    const content = JSON.parse(
      fs.readFileSync(path.join(tmpDir, result.filename!), 'utf-8'),
    ) as Record<string, unknown>;
    expect(content.version).toBe('1.0');
    expect(content.amounts_in_cents).toBe(true);
    expect(Array.isArray(content.accounts)).toBe(true);
    expect(Array.isArray(content.transactions)).toBe(true);
  });

  it('met à jour backup_last_at et backup_last_hash après création', () => {
    const before = Date.now();
    runBackup(fixtures.db, fixtures.userId, tmpDir);
    const row = fixtures.db
      .prepare<
        [number],
        { backup_last_at: string; backup_last_hash: string }
      >('SELECT backup_last_at, backup_last_hash FROM user_settings WHERE user_id = ?')
      .get(fixtures.userId);
    expect(new Date(row!.backup_last_at).getTime()).toBeGreaterThanOrEqual(before);
    expect(row!.backup_last_hash).toHaveLength(64); // SHA-256 hex
  });

  it('retourne skipped=true si les données sont identiques au backup précédent', () => {
    runBackup(fixtures.db, fixtures.userId, tmpDir); // premier backup
    const result = runBackup(fixtures.db, fixtures.userId, tmpDir); // même données
    expect(result.skipped).toBe(true);
    expect(result.filename).toBeNull();
    expect(listBackups(tmpDir)).toHaveLength(1); // toujours 1 seul fichier
  });

  it('met à jour backup_last_at même quand skipped', () => {
    runBackup(fixtures.db, fixtures.userId, tmpDir);
    const before = Date.now();
    runBackup(fixtures.db, fixtures.userId, tmpDir);
    const row = fixtures.db
      .prepare<
        [number],
        { backup_last_at: string }
      >('SELECT backup_last_at FROM user_settings WHERE user_id = ?')
      .get(fixtures.userId);
    expect(new Date(row!.backup_last_at).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('crée un nouveau backup si les données ont changé depuis le dernier', () => {
    runBackup(fixtures.db, fixtures.userId, tmpDir);
    // Modifier les données
    fixtures.db
      .prepare('INSERT INTO accounts (user_id, name, bank_id, account_type_id) VALUES (?, ?, 1, 1)')
      .run(fixtures.userId, 'Nouveau compte');
    const result = runBackup(fixtures.db, fixtures.userId, tmpDir);
    expect(result.skipped).toBe(false);
    expect(listBackups(tmpDir)).toHaveLength(2);
  });

  it("crée le dossier cible s'il n'existe pas", () => {
    const nested = path.join(tmpDir, 'sub', 'backups');
    runBackup(fixtures.db, fixtures.userId, nested);
    expect(fs.existsSync(nested)).toBe(true);
  });
});

describe('startBackupInterval', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ne fait rien s'il n'y a aucun utilisateur dans la base", () => {
    vi.useFakeTimers();
    const db = createTestDb();
    const handle = startBackupInterval(db, 1000, tmpDir);
    vi.advanceTimersByTime(1000);
    clearInterval(handle);
    db.close();
    expect(listBackups(tmpDir)).toHaveLength(0);
  });

  it('ne crée pas de backup si backup_enabled = false (défaut)', () => {
    vi.useFakeTimers();
    const handle = startBackupInterval(fixtures.db, 1000, tmpDir);
    vi.advanceTimersByTime(1000);
    clearInterval(handle);
    expect(listBackups(tmpDir)).toHaveLength(0);
  });

  it("ne crée pas de backup si la fréquence n'est pas encore atteinte", () => {
    vi.useFakeTimers();
    fixtures.db
      .prepare(
        `INSERT INTO user_settings (user_id, lead_days, backup_enabled, backup_frequency_h, backup_max_files, backup_last_at)
         VALUES (?, 30, 1, 24, 7, ?)`,
      )
      .run(fixtures.userId, new Date().toISOString());
    const handle = startBackupInterval(fixtures.db, 1000, tmpDir);
    vi.advanceTimersByTime(1000);
    clearInterval(handle);
    expect(listBackups(tmpDir)).toHaveLength(0);
  });

  it('crée un backup quand backup_enabled et la fréquence est atteinte', () => {
    vi.useFakeTimers();
    fixtures.db
      .prepare(
        `INSERT INTO user_settings (user_id, lead_days, backup_enabled, backup_frequency_h, backup_max_files)
         VALUES (?, 30, 1, 1, 7)`,
      )
      .run(fixtures.userId);
    const handle = startBackupInterval(fixtures.db, 1000, tmpDir);
    vi.advanceTimersByTime(1000);
    clearInterval(handle);
    const row = fixtures.db
      .prepare<
        [number],
        { backup_last_hash: string | null }
      >('SELECT backup_last_hash FROM user_settings WHERE user_id = ?')
      .get(fixtures.userId);
    expect(row?.backup_last_hash).not.toBeNull();
  });

  it('capture les erreurs du backup sans propager', () => {
    vi.useFakeTimers();
    const db = createTestDb();
    db.close();
    const handle = startBackupInterval(db, 1000, tmpDir);
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    clearInterval(handle);
  });
});
