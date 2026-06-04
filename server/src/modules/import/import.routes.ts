import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { INSURANCE_OPERATION_TYPES, INSURANCE_SUPPORT_TYPES } from '../../constants.js';
import { zodToApiError } from '../../lib/routeHelpers.js';
import { dateSchema, optionalDateSchema } from '../../lib/validators';
import { requireAuth, sessionUserId } from '../../middleware.js';
import type { FullExport } from '../export/export.types.js';
import { createImportRepo } from './import.repo.js';

const newAccountSchema = z.object({
  qif_name: z.string().min(1),
  name: z.string().min(1).max(100),
  bank_id: z.number().int().positive().nullable(),
  account_type_id: z.number().int().positive().nullable(),
  initial_balance: z.number().default(0),
  opening_date: optionalDateSchema,
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
    date: dateSchema,
    notes: z.string().max(1000).nullable(),
    validated: z.boolean(),
    payment_method_id: z.number().int().positive().nullable().default(null),
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
    date: dateSchema,
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

const splitSchema = z.object({
  subcategory_id: z.number().int().positive(),
  amount: z.number().int().positive(),
});

const fullTransactionSchema = z.object({
  id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  type: z.enum(['income', 'expense']),
  amount: z.number().int().positive(),
  description: z.string().max(200),
  subcategory_id: z.number().int().positive().nullable(),
  payment_method_id: z.number().int().positive().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validated: z.number().int(),
  notes: z.string().nullable(),
  transfer_peer_id: z.number().int().positive().nullable(),
  reimbursement_status: z.enum(['en_attente', 'rembourse']).nullable(),
  scheduled_id: z.number().int().positive().nullable(),
  splits: z.array(splitSchema),
});

const jsonFullSchema = z.object({
  version: z.literal('1.0'),
  amounts_in_cents: z.literal(true),
  account_types: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(100),
      envelope_type: z.string().nullable().default(null),
    }),
  ),
  banks: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(100),
      logo: z.string().nullable(),
      domain: z.string().nullable(),
    }),
  ),
  accounts: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(100),
      bank_id: z.number().int().positive().nullable(),
      account_type_id: z.number().int().positive(),
      initial_balance: z.number().int(),
      opening_date: z.string().nullable(),
      closed_at: z.string().nullable(),
    }),
  ),
  categories: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(50),
      icon: z.string().max(64),
      subcategories: z.array(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).max(50),
        }),
      ),
    }),
  ),
  payment_methods: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(100),
      icon: z.string().max(64),
    }),
  ),
  transactions: z.array(fullTransactionSchema),
  scheduled_transactions: z.array(
    z.object({
      id: z.number().int().positive(),
      account_id: z.number().int().positive(),
      type: z.enum(['income', 'expense']),
      amount: z.number().int().positive(),
      description: z.string().max(200),
      subcategory_id: z.number().int().positive().nullable(),
      payment_method_id: z.number().int().positive().nullable(),
      notes: z.string().nullable(),
      recurrence_unit: z.string().min(1),
      recurrence_interval: z.number().int().positive(),
      recurrence_day: z.number().int().nullable(),
      recurrence_month: z.number().int().nullable(),
      to_account_id: z.number().int().positive().nullable(),
      weekend_handling: z.string().min(1),
      start_date: dateSchema,
      end_date: z.string().nullable(),
      active: z.number().int(),
      last_generated_until: z.string().nullable().default(null),
    }),
  ),
  stock_positions: z.array(
    z.object({
      account_id: z.number().int().positive(),
      ticker: z.string().min(1).max(20),
      quantity: z.number(),
      avg_price: z.number(),
    }),
  ),
  stock_operations: z.array(
    z.object({
      id: z.number().int().positive(),
      account_id: z.number().int().positive(),
      transaction_id: z.number().int().positive().nullable(),
      fees_transaction_id: z.number().int().positive().nullable(),
      ticker: z.string().min(1).max(20),
      type: z.enum(['buy', 'sell', 'transfer_in', 'transfer_out']),
      quantity: z.number(),
      price_per_share: z.number(),
      fees: z.number().int(),
      date: dateSchema,
    }),
  ),
  loans: z.array(
    z.object({
      id: z.number().int().positive(),
      account_id: z.number().int().positive(),
      principal_amount: z.number().int().positive(),
      interest_rate: z.number(),
      duration_months: z.number().int().positive(),
      start_date: dateSchema,
      monthly_payment: z.number().int().positive(),
      source_account_id: z.number().int().positive(),
      deposit_account_id: z.number().int().positive(),
      deposit_transaction_id: z.number().int().positive().nullable(),
      installments: z.array(
        z.object({
          installment_number: z.number().int().positive(),
          due_date: dateSchema,
          total_amount: z.number().int(),
          principal_amount: z.number().int(),
          interest_amount: z.number().int(),
          transaction_id: z.number().int().positive().nullable(),
        }),
      ),
    }),
  ),
  insurance_supports: z
    .array(
      z.object({
        id: z.number().int().positive(),
        account_id: z.number().int().positive(),
        name: z.string().min(1),
        type: z.enum(INSURANCE_SUPPORT_TYPES),
        ticker: z.string().nullable(),
      }),
    )
    .default([]),
  insurance_operations: z
    .array(
      z.object({
        id: z.number().int().positive(),
        account_id: z.number().int().positive(),
        support_id: z.number().int().positive(),
        transaction_id: z.number().int().positive().nullable(),
        fees_transaction_id: z.number().int().positive().nullable(),
        social_fees_transaction_id: z.number().int().positive().nullable().default(null),
        type: z.enum(INSURANCE_OPERATION_TYPES),
        amount: z.number().int(),
        fees: z.number().int(),
        social_fees: z.number().int().default(0),
        date: dateSchema,
        arbitrage_peer_id: z.number().int().positive().nullable(),
      }),
    )
    .default([]),
});

export function createImportRouter(db: Database): Router {
  const repo = createImportRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.post('/qif', (req, res) => {
    const parsed = executeSchema.safeParse(req.body);
    if (!parsed.success) {
      // Forme structurée : les `path` (transactions.K.field / transfers.K.field)
      // permettent au client de remonter l'erreur sur la bonne ligne de l'aperçu.
      res.status(400).json({ error: zodToApiError(parsed.error) });
      return;
    }
    const result = repo.execute(sessionUserId(req), parsed.data);
    res.status(201).json(result);
  });

  router.post('/json-full', (req, res) => {
    const parsed = jsonFullSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: zodToApiError(parsed.error) });
      return;
    }
    const result = repo.executeJsonFull(sessionUserId(req), parsed.data as FullExport);
    res.status(201).json(result);
  });

  return router;
}
