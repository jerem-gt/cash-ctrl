import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';

export const exportRouter = Router();
exportRouter.use(requireAuth);

exportRouter.get('/csv', (req, res) => {
  const rows = db.prepare(`
    SELECT t.date, t.type, t.description, t.category, a.name as account, t.amount
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC
  `).all(req.session.userId!) as Array<{
    date: string; type: string; description: string;
    category: string; account: string; amount: number;
  }>;

  const header = ['Date', 'Type', 'Description', 'Catégorie', 'Compte', 'Montant (€)'];
  const lines = rows.map(r => [
    r.date,
    r.type === 'income' ? 'Revenu' : 'Dépense',
    `"${r.description.replace(/"/g, '""')}"`,
    r.category,
    r.account,
    (r.type === 'expense' ? -r.amount : r.amount).toFixed(2),
  ].join(';'));

  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\n');
  const date = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cashctrl-${date}.csv"`);
  res.send(csv);
});

exportRouter.get('/json', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(req.session.userId!);
  const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ?').all(req.session.userId!);
  const date = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Disposition', `attachment; filename="cashctrl-backup-${date}.json"`);
  res.json({ exported_at: new Date().toISOString(), accounts, transactions });
});
