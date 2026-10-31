import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { toCents, toEuros } from '../../lib/money.js';
import { parseIdParam } from '../../lib/routeHelpers.js';
import { dateSchema, nameSchema, optionalDateSchema } from '../../lib/validators.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createLoansRepo } from '../loans/loans.repo.js';
import { createTransfersRepo } from '../transfers/transfers.repo.js';
import { createAccountsRepo } from './accounts.repo.js';

export const accountSchema = z.object({
  name: nameSchema,
  bank_id: z.number().int().positive().nullable().default(null),
  account_type_id: z.number().int().positive().nullable().default(null),
  initial_balance: z.coerce.number().default(0),
  opening_date: optionalDateSchema,
});

export const closeSchema = z.object({
  closed_at: dateSchema,
  transfer_to_account_id: z.number().int().positive().optional(),
});

export const favoriteSchema = z.object({ favorite: z.boolean() });

export const favoritesReorderSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      favorite_order: z.number().int().nonnegative(),
    }),
  )
  .refine(
    (items) =>
      new Set(items.map((i) => i.id)).size === items.length &&
      new Set(items.map((i) => i.favorite_order)).size === items.length,
    { message: 'ids et ordres doivent être uniques' },
  );

export function createAccountsRouter(db: Database): Router {
  const accountsRepo = createAccountsRepo(db);
  const loansRepo = createLoansRepo(db);
  const transfersRepo = createTransfersRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(accountsRepo.getByUserId(currentUserId(res)));
  });

  router.post('/', (req, res) => {
    const data = accountSchema.parse(req.body);
    const userId = currentUserId(res);
    const result = accountsRepo.create(userId, data);
    res.status(201).json(accountsRepo.getById(Number(result.lastInsertRowid), userId));
  });

  router.put('/favorites/reorder', (req, res) => {
    const data = favoritesReorderSchema.parse(req.body);
    const userId = currentUserId(res);
    const activeIds = accountsRepo.getActiveFavoriteIds(userId);
    const submitted = new Set(data.map((item) => item.id));
    if (activeIds.length !== submitted.size || activeIds.some((id) => !submitted.has(id))) {
      throw new ConflictError('account.favorites_out_of_sync');
    }
    accountsRepo.reorderFavorites(userId, data);
    res.status(204).end();
  });

  router.get('/:id/frequent-transactions', (req, res) => {
    const id = parseIdParam(req);
    const userId = currentUserId(res);
    if (!accountsRepo.exists(id, userId)) {
      throw new NotFoundError('account.not_found');
    }
    res.json(accountsRepo.getFrequentTransactions(userId, id));
  });

  router.put('/:id/favorite', (req, res) => {
    const id = parseIdParam(req);
    const userId = currentUserId(res);
    const account = accountsRepo.getById(id, userId);
    if (!account) {
      throw new NotFoundError('account.not_found');
    }
    const data = favoriteSchema.parse(req.body);
    if (data.favorite && account.closed_at) {
      throw new ConflictError('account.favorite_closed');
    }
    accountsRepo.setFavorite(userId, id, data.favorite);
    res.json(accountsRepo.getById(id, userId));
  });

  router.put('/:id', (req, res) => {
    const id = parseIdParam(req);
    const userId = currentUserId(res);
    if (!accountsRepo.getById(id, userId)) {
      throw new NotFoundError('account.not_found');
    }
    const data = accountSchema.parse(req.body);
    accountsRepo.update(userId, id, data);
    res.json(accountsRepo.getById(id, userId));
  });

  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req);
    const userId = currentUserId(res);
    const account = accountsRepo.getById(id, userId);
    if (!account) {
      throw new NotFoundError('account.not_found');
    }
    if (account.envelope_type === 'loan') {
      loansRepo.cleanupTransactions(id);
    }
    accountsRepo.delete(userId, id);
    res.status(204).end();
  });

  router.post('/:id/close', (req, res) => {
    const id = parseIdParam(req);
    const userId = currentUserId(res);
    const account = accountsRepo.getById(id, userId);
    if (!account) {
      throw new NotFoundError('account.not_found');
    }
    if (account.closed_at) {
      throw new BadRequestError('account.already_closed');
    }
    const data = closeSchema.parse(req.body);
    const isInsurance =
      account.envelope_type === 'life_insurance' || account.envelope_type === 'per';
    const balance = toEuros(toCents(isInsurance ? account.balance_insurance : account.balance));
    if (balance !== 0 && !data.transfer_to_account_id) {
      throw new BadRequestError('account.close_requires_zero_or_target');
    }

    // Transfert à faire avant clôture
    db.transaction(() => {
      if (balance !== 0 && data.transfer_to_account_id) {
        const description = `Virement de clôture — ${account.name}`;
        const amount = Math.abs(balance);
        const [fromId, toId] =
          balance > 0 ? [id, data.transfer_to_account_id] : [data.transfer_to_account_id, id];
        transfersRepo.create(userId, {
          amount: amount,
          date: data.closed_at,
          description: description,
          from_account_id: fromId,
          to_account_id: toId,
          validated: true,
        });
      }
      accountsRepo.close(userId, id, data);
    })();
    res.json(accountsRepo.getById(id, userId));
  });

  router.post('/:id/reopen', (req, res) => {
    const id = parseIdParam(req);
    const userId = currentUserId(res);
    const account = accountsRepo.getById(id, userId);
    if (!account) {
      throw new NotFoundError('account.not_found');
    }
    if (!account.closed_at) {
      throw new BadRequestError('account.not_closed');
    }
    accountsRepo.reopen(userId, id);
    res.json(accountsRepo.getById(id, userId));
  });

  return router;
}
