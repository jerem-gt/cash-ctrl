import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', (req, res) => {
  const userId = req.session.userId!;
  let row = db.prepare('SELECT lead_days FROM user_settings WHERE user_id = ?').get(userId) as { lead_days: number } | undefined;

  if (!row) {
    db.prepare('INSERT INTO user_settings (user_id, lead_days) VALUES (?, 30)').run(userId);
    row = { lead_days: 30 };
  }

  res.json(row);
});

settingsRouter.put('/', (req, res) => {
  const userId = req.session.userId!;
  const parsed = z.object({ lead_days: z.number().int().min(0).max(365) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

  db.prepare(`
    INSERT INTO user_settings (user_id, lead_days) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET lead_days = excluded.lead_days
  `).run(userId, parsed.data.lead_days);

  res.json({ lead_days: parsed.data.lead_days });
});
