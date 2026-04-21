import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';

export const exportRouter = Router();
exportRouter.use(requireAuth);

exportRouter.get('/csv', (req, res) => {
  const rows = db.prepare(`
    SELECT t.date, t.type, t.description, t.category, a.name as account,
           t.amount, t.payment_method, t.validated, t.notes
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC
  `).all(req.session.userId!) as Array<{
    date: string; type: string; description: string; category: string;
    account: string; amount: number; payment_method: string; validated: number; notes: string | null;
  }>;

  const header = ['Date', 'Type', 'Description', 'Catégorie', 'Compte', 'Montant (€)', 'Moyen de paiement', 'Validée', 'Notes'];
  const lines = rows.map(r => [
    r.date,
    r.type === 'income' ? 'Revenu' : 'Dépense',
    `"${r.description.replaceAll('"', '""')}"`,
    r.category,
    r.account,
    (r.type === 'expense' ? -r.amount : r.amount).toFixed(2),
    r.payment_method,
    r.validated ? 'Oui' : 'Non',
    r.notes ? `"${r.notes.replaceAll('"', '""')}"` : '',
  ].join(';'));

  const csv = '﻿' + [header.join(';'), ...lines].join('\n');
  const date = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cashctrl-${date}.csv"`);
  res.send(csv);
});

exportRouter.get('/json', (req, res) => {
  const accounts = db.prepare(`
    SELECT id, name, bank, type, initial_balance, created_at
    FROM accounts WHERE user_id = ?
  `).all(req.session.userId!);

  const transactions = db.prepare(`
    SELECT id, account_id, type, amount, description, category, date,
           payment_method, validated, notes, transfer_peer_id, created_at
    FROM transactions WHERE user_id = ?
  `).all(req.session.userId!);

  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Disposition', `attachment; filename="cashctrl-backup-${date}.json"`);
  res.json({ exported_at: new Date().toISOString(), accounts, transactions });
});
