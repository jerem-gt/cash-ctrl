import fs from 'node:fs';
import path from 'node:path';

import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import {
  BACKUP_DIR,
  listBackups,
  rotateBackups,
  runBackup,
  userBackupDir,
} from '../../lib/backup.js';
import { sendError } from '../../lib/routeHelpers.js';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createSettingsRepo } from '../settings/settings.repo.js';

const FILENAME_RE = /^cashctrl-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(-\d{3})?\.json$/;

export function createBackupRouter(db: Database, backupDir = BACKUP_DIR): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/list', (req, res) => {
    const userId = sessionUserId(req);
    res.json(listBackups(userBackupDir(backupDir, userId)));
  });

  router.post('/run', (req, res) => {
    const userId = sessionUserId(req);
    const result = runBackup(db, userId, backupDir);
    if (result.skipped) {
      res.status(200).json({ skipped: true, filename: null });
      return;
    }
    const settingsRepo = createSettingsRepo(db);
    const settings = settingsRepo.get(userId);
    rotateBackups(settings.backup_max_files, userBackupDir(backupDir, userId));
    res.status(201).json({ skipped: false, filename: result.filename });
  });

  router.get('/:filename', (req, res) => {
    const userId = sessionUserId(req);
    const { filename } = req.params;
    if (!FILENAME_RE.test(filename)) {
      sendError(res, 400, 'backup.invalid_filename');
      return;
    }
    const filePath = path.join(userBackupDir(backupDir, userId), filename);
    if (!fs.existsSync(filePath)) {
      sendError(res, 404, 'backup.not_found');
      return;
    }
    res.download(filePath, filename);
  });

  return router;
}
