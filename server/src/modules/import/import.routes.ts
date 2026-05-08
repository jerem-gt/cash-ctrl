import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, sessionUserId } from '../../middleware.js';
import { createImportRepo } from './import.repo.js';

const newAccountSchema = z.object({
  qif_name: z.string().min(1),
  name: z.string().min(1).max(100),
  bank_id: z.number().int().positive().nullable(),
  account_type_id: z.number().int().positive().nullable(),
  initial_balance: z.number().default(0),
  opening_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

const newSubcategorySchema = z
  .object({
    qif_key: z.string().min(1),
    category_id: z.number().int().positive().optional(),
    new_category_name: z.string().min(1).max(50).optional(),
    new_category_icon: z.string().max(64).optional(),
    subcategory_name: z.string().min(1).max(50),
  })
  .refine((d) => d.category_id !== undefined || d.new_category_name !== undefined, {
    message: 'category_id ou new_category_name requis',
  });

const transactionSchema = z
  .object({
    account_id: z.number().int().positive().nullable(),
    new_account_qif_name: z.string().nullable(),
    type: z.enum(['income', 'expense']),
    amount: z.number().positive(),
    description: z.string().min(1).max(200),
    subcategory_id: z.number().int().positive().nullable(),
    new_subcategory_key: z.string().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(1000).nullable(),
    validated: z.boolean(),
  })
  .refine((d) => d.account_id !== null || d.new_account_qif_name !== null, {
    message: 'account_id ou new_account_qif_name requis',
  });

const transferSchema = z
  .object({
    from_account_id: z.number().int().positive().nullable(),
    from_account_qif_name: z.string().nullable(),
    to_account_id: z.number().int().positive().nullable(),
    to_account_qif_name: z.string().nullable(),
    amount: z.number().positive(),
    description: z.string().min(1).max(200),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(1000).nullable(),
    validated: z.boolean(),
  })
  .refine((d) => d.from_account_id !== null || d.from_account_qif_name !== null, {
    message: 'from_account_id ou from_account_qif_name requis',
  })
  .refine((d) => d.to_account_id !== null || d.to_account_qif_name !== null, {
    message: 'to_account_id ou to_account_qif_name requis',
  });

const executeSchema = z.object({
  newAccounts: z.array(newAccountSchema),
  newSubcategories: z.array(newSubcategorySchema),
  transactions: z.array(transactionSchema),
  transfers: z.array(transferSchema),
});

export function createImportRouter(db: Database): Router {
  const repo = createImportRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.post('/qif', (req, res) => {
    const parsed = executeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const result = repo.execute(sessionUserId(req), parsed.data);
    res.status(201).json(result);
  });

  return router;
}
