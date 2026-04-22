import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { generateScheduledTransactions } from '../lib/generateScheduled.js';

export const scheduledRouter = Router();
scheduledRouter.use(requireAuth);

const scheduledSchema = z.object({
  account_id: z.number().int().positive(),
  to_account_id: z.number().int().positive().nullable().default(null),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  category: z.string().min(1),
  payment_method: z.string().min(1).max(100),
  notes: z.string().max(1000).nullable().default(null),
  recurrence_unit: z.enum(['day', 'week', 'month', 'year']),
  recurrence_interval: z.number().int().min(1).default(1),
  recurrence_day: z.number().int().min(1).max(31).nullable().default(null),
  recurrence_month: z.number().int().min(1).max(12).nullable().default(null),
  weekend_handling: z.enum(['allow', 'before', 'after']).default('allow'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  active: z.boolean().default(true),
});

const selectWithAccount = `
  SELECT s.*, a.name as account_name
  FROM scheduled_transactions s
  JOIN accounts a ON s.account_id = a.id
  WHERE s.id = ?
`;

scheduledRouter.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, a.name as account_name
    FROM scheduled_transactions s
    JOIN accounts a ON s.account_id = a.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).all(req.session.userId!);
  res.json(rows);
});

scheduledRouter.post('/', (req, res) => {
  const parsed = scheduledSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

  const d = parsed.data;
  if (d.payment_method === 'Transfert') {
    if (!d.to_account_id) { res.status(400).json({ error: 'Un compte destination est requis pour un transfert' }); return; }
    if (d.to_account_id === d.account_id) { res.status(400).json({ error: 'Les deux comptes doivent être différents' }); return; }
  }

  const result = db.prepare(`
    INSERT INTO scheduled_transactions
      (user_id, account_id, to_account_id, type, amount, description, category, payment_method, notes,
       recurrence_unit, recurrence_interval, recurrence_day, recurrence_month,
       weekend_handling, start_date, end_date, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.session.userId!, d.account_id, d.to_account_id, d.type, d.amount, d.description.trim(),
    d.category, d.payment_method, d.notes,
    d.recurrence_unit, d.recurrence_interval, d.recurrence_day, d.recurrence_month,
    d.weekend_handling, d.start_date, d.end_date, d.active ? 1 : 0
  );

  generateScheduledTransactions(req.session.userId!);

  res.status(201).json(db.prepare(selectWithAccount).get(result.lastInsertRowid));
});

scheduledRouter.put('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  const userId = req.session.userId!;

  const existing = db.prepare('SELECT id FROM scheduled_transactions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) { res.status(404).json({ error: 'Planification introuvable' }); return; }

  const parsed = scheduledSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

  const d = parsed.data;
  if (d.payment_method === 'Transfert') {
    if (!d.to_account_id) { res.status(400).json({ error: 'Un compte destination est requis pour un transfert' }); return; }
    if (d.to_account_id === d.account_id) { res.status(400).json({ error: 'Les deux comptes doivent être différents' }); return; }
  }

  const today = new Date().toISOString().split('T')[0];

  db.transaction(() => {
    // Supprime les instances futures non validées pour repartir proprement
    db.prepare(`
      DELETE FROM transactions WHERE scheduled_id = ? AND user_id = ? AND date > ? AND validated = 0
    `).run(id, userId, today);

    db.prepare(`
      UPDATE scheduled_transactions SET
        account_id = ?, to_account_id = ?, type = ?, amount = ?, description = ?, category = ?,
        payment_method = ?, notes = ?, recurrence_unit = ?, recurrence_interval = ?,
        recurrence_day = ?, recurrence_month = ?, weekend_handling = ?,
        start_date = ?, end_date = ?, active = ?, last_generated_until = NULL
      WHERE id = ? AND user_id = ?
    `).run(
      d.account_id, d.to_account_id, d.type, d.amount, d.description.trim(), d.category,
      d.payment_method, d.notes, d.recurrence_unit, d.recurrence_interval,
      d.recurrence_day, d.recurrence_month, d.weekend_handling,
      d.start_date, d.end_date, d.active ? 1 : 0,
      id, userId
    );
  })();

  generateScheduledTransactions(userId);

  res.json(db.prepare(selectWithAccount).get(id));
});

scheduledRouter.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id);
  const userId = req.session.userId!;

  const existing = db.prepare('SELECT id FROM scheduled_transactions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) { res.status(404).json({ error: 'Planification introuvable' }); return; }

  const today = new Date().toISOString().split('T')[0];

  db.transaction(() => {
    db.prepare(`
      DELETE FROM transactions WHERE scheduled_id = ? AND user_id = ? AND date > ? AND validated = 0
    `).run(id, userId, today);
    db.prepare('DELETE FROM scheduled_transactions WHERE id = ? AND user_id = ?').run(id, userId);
  })();

  res.json({ ok: true });
});
