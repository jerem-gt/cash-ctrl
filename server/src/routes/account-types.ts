import { Router } from 'express';
import { z } from 'zod';
import { queries } from '../db.js';
import { requireAuth } from '../middleware.js';

export const accountTypesRouter = Router();
accountTypesRouter.use(requireAuth);

const schema = z.object({ name: z.string().min(1).max(50) });

accountTypesRouter.get('/', (_req, res) => {
  res.json(queries.getAccountTypes.all());
});

accountTypesRouter.post('/', (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  const result = queries.insertAccountType.run(parsed.data.name.trim());
  res.status(201).json(queries.getAccountTypeById.get(Number(result.lastInsertRowid)));
});

accountTypesRouter.put('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  if (!queries.getAccountTypeById.get(id)) { res.status(404).json({ error: 'Account type not found' }); return; }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  queries.updateAccountType.run(parsed.data.name.trim(), id);
  res.json(queries.getAccountTypeById.get(id));
});

accountTypesRouter.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  if (!queries.getAccountTypeById.get(id)) { res.status(404).json({ error: 'Account type not found' }); return; }
  queries.deleteAccountType.run(id);
  res.json({ ok: true });
});
