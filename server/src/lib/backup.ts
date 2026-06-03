import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { Database } from 'better-sqlite3';

import { DATA_DIR } from '../db/init';
import { logger } from '../logger';
import { createExportRepo } from '../modules/export/export.repo';
import type { FullExport } from '../modules/export/export.types';
import { createSettingsRepo } from '../modules/settings/settings.repo';

export const BACKUP_DIR = path.join(DATA_DIR, 'backups');

export interface BackupFile {
  filename: string;
  size: number;
  created_at: string;
}

export type BackupResult = { skipped: false; filename: string } | { skipped: true; filename: null };

function backupFilenameToTimestamp(filename: string): string {
  const raw = filename.replace('cashctrl-backup-', '').replace('.json', '');
  // With ms:    2026-05-14T10-30-00-123 → 2026-05-14T10:30:00.123Z
  // Without ms: 2026-05-14T10-30-00     → 2026-05-14T10:30:00Z  (legacy)
  return (
    raw
      .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})$/, 'T$1:$2:$3.$4')
      .replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3') + 'Z'
  );
}

function hashExport(data: FullExport): string {
  // Exclude exported_at — it changes on every call even if data is identical
  const stable = Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'exported_at'));
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function userBackupDir(baseDir: string, userId: number): string {
  return path.join(baseDir, String(userId));
}

// backupDir est le dossier par utilisateur (`<BACKUP_DIR>/<userId>`), pas la racine :
// les fichiers de sauvegarde vivent dans des sous-dossiers, jamais directement dans BACKUP_DIR.
export function listBackups(backupDir: string): BackupFile[] {
  if (!fs.existsSync(backupDir)) return [];

  return fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('cashctrl-backup-') && f.endsWith('.json'))
    .map((filename) => {
      const stats = fs.statSync(path.join(backupDir, filename));
      return {
        filename,
        size: stats.size,
        created_at: backupFilenameToTimestamp(filename),
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export function rotateBackups(maxFiles: number, backupDir: string): void {
  const files = listBackups(backupDir);
  if (files.length <= maxFiles) return;

  const toDelete = files.slice(0, files.length - maxFiles);
  for (const file of toDelete) {
    fs.unlinkSync(path.join(backupDir, file.filename));
  }
}

export function runBackup(db: Database, userId: number, backupDir = BACKUP_DIR): BackupResult {
  const dir = userBackupDir(backupDir, userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const exportRepo = createExportRepo(db);
  const data = exportRepo.getFullExport(userId);
  const newHash = hashExport(data);

  const settingsRepo = createSettingsRepo(db);
  const settings = settingsRepo.get(userId);
  const now = new Date();

  if (settings.backup_last_hash === newHash) {
    // Data unchanged — record the check time but don't write a file
    settingsRepo.updateBackupLastAt(userId, now.toISOString());
    return { skipped: true, filename: null };
  }

  // Include milliseconds to guarantee uniqueness within the same second
  const timestamp = now.toISOString().replaceAll(':', '-').replaceAll('.', '-').replace('Z', '');
  const filename = `cashctrl-backup-${timestamp}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(data, null, 2), 'utf-8');

  settingsRepo.updateAfterBackup(userId, now.toISOString(), newHash);

  return { skipped: false, filename };
}

export function startBackupInterval(
  db: Database,
  intervalMs = 60 * 60 * 1000,
  backupDir = BACKUP_DIR,
): NodeJS.Timeout {
  const check = () => {
    try {
      const rows = db.prepare<[], { id: number }>('SELECT id FROM users').all();
      const settingsRepo = createSettingsRepo(db);

      for (const row of rows) {
        const userId = row.id;
        const settings = settingsRepo.get(userId);

        if (!settings.backup_enabled) continue;

        const freqMs = settings.backup_frequency_h * 60 * 60 * 1000;
        const lastMs = settings.backup_last_at ? new Date(settings.backup_last_at).getTime() : 0;

        if (Date.now() - lastMs >= freqMs) {
          const result = runBackup(db, userId, backupDir);
          if (!result.skipped) {
            rotateBackups(settings.backup_max_files, userBackupDir(backupDir, userId));
            logger.info(`Auto backup created: ${result.filename}`);
          }
        }
      }
    } catch (err: unknown) {
      logger.error(`Backup interval error: ${String(err)}`);
    }
  };

  return setInterval(check, intervalMs);
}
