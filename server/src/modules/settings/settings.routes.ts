import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { parseBody, sendError } from '../../lib/routeHelpers';
import { SYSTEM_REF_COLUMNS, type SystemRefColumn } from '../../lib/systemEntities';
import { requireAuth, sessionUserId } from '../../middleware.js';
import { createSettingsRepo } from './settings.repo';

export const settingsSchema = z.object({
  lead_days: z.number().int().min(0).max(365),
  backup_enabled: z.boolean(),
  backup_frequency_h: z.number().int().min(1).max(8760),
  backup_max_files: z.number().int().min(1).max(100),
});

// Schema for updating system entity references
export const systemRefsSchema = z
  .object({
    financial_income_category_id: z.number().int().positive().nullable().optional(),
    transfer_subcategory_id: z.number().int().positive().nullable().optional(),
    transfer_payment_method_id: z.number().int().positive().nullable().optional(),
    bank_fees_subcategory_id: z.number().int().positive().nullable().optional(),
    social_fees_subcategory_id: z.number().int().positive().nullable().optional(),
    prelevement_payment_method_id: z.number().int().positive().nullable().optional(),
  })
  .strict();

function formatSettings(s: ReturnType<ReturnType<typeof createSettingsRepo>['get']>) {
  return {
    lead_days: s.lead_days,
    backup_enabled: s.backup_enabled === 1,
    backup_frequency_h: s.backup_frequency_h,
    backup_max_files: s.backup_max_files,
    backup_last_at: s.backup_last_at,
    financial_income_category_id: s.financial_income_category_id,
    transfer_subcategory_id: s.transfer_subcategory_id,
    transfer_payment_method_id: s.transfer_payment_method_id,
    bank_fees_subcategory_id: s.bank_fees_subcategory_id,
    social_fees_subcategory_id: s.social_fees_subcategory_id,
    prelevement_payment_method_id: s.prelevement_payment_method_id,
  };
}

// For a given settings column, determine which table to look up
const COLUMN_TABLE: Record<SystemRefColumn, string> = {
  financial_income_category_id: 'categories',
  transfer_subcategory_id: 'subcategories',
  transfer_payment_method_id: 'payment_methods',
  bank_fees_subcategory_id: 'subcategories',
  social_fees_subcategory_id: 'subcategories',
  prelevement_payment_method_id: 'payment_methods',
};

export function createSettingsRouter(db: Database): Router {
  const settingsRepo = createSettingsRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const s = settingsRepo.get(sessionUserId(req));
    res.json(formatSettings(s));
  });

  router.put('/', (req, res) => {
    const data = parseBody(res, settingsSchema, req.body);
    if (!data) return;
    const userId = sessionUserId(req);
    const { lead_days, backup_enabled, backup_frequency_h, backup_max_files } = data;
    settingsRepo.upsert(userId, {
      leadDays: lead_days,
      backupEnabled: backup_enabled,
      backupFrequencyH: backup_frequency_h,
      backupMaxFiles: backup_max_files,
    });
    const u = settingsRepo.get(userId);
    res.json(formatSettings(u));
  });

  router.patch('/system-refs', (req, res) => {
    const data = parseBody(res, systemRefsSchema, req.body);
    if (!data) return;
    const userId = sessionUserId(req);

    // Validate each provided id belongs to the user
    const refs: Partial<Record<SystemRefColumn, number | null>> = {};
    for (const col of SYSTEM_REF_COLUMNS) {
      const val = data[col];
      if (val === undefined) continue;
      if (val === null) {
        refs[col] = null;
        continue;
      }
      const table = COLUMN_TABLE[col];
      if (!settingsRepo.entityBelongsToUser(table, val, userId)) {
        sendError(res, 400, 'settings.ref_not_owned', { col, id: val });
        return;
      }
      refs[col] = val;
    }

    settingsRepo.setSystemRefs(userId, refs);
    const u = settingsRepo.get(userId);
    res.json(formatSettings(u));
  });

  return router;
}
