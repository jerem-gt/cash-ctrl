import { Router } from 'express';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware.js';

export function createExportRouter(db: Database.Database): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/csv', (req, res) => {
    const rows = db.prepare(`
      SELECT t.date, t.type, t.description,
             COALESCE(c.name, '') as category,
             a.name as account,
             t.amount,
             COALESCE(pm.name, '') as payment_method,
             t.validated, t.notes
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
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

  router.get('/json', (req, res) => {
    const accounts = db.prepare(`
      SELECT a.id, a.name, COALESCE(b.name, '') as bank, COALESCE(at.name, '') as type, a.initial_balance, a.created_at
      FROM accounts a
      LEFT JOIN banks b ON a.bank_id = b.id
      LEFT JOIN account_types at ON a.account_type_id = at.id
      WHERE a.user_id = ?
    `).all(req.session.userId!);

    const transactions = db.prepare(`
      SELECT t.id, t.account_id, t.type, t.amount, t.description,
             t.category_id, t.payment_method_id,
             COALESCE(c.name, '') as category,
             COALESCE(pm.name, '') as payment_method,
             t.date, t.validated, t.notes, t.transfer_peer_id, t.created_at
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      WHERE t.user_id = ?
    `).all(req.session.userId!);

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="cashctrl-backup-${date}.json"`);
    res.json({ exported_at: new Date().toISOString(), accounts, transactions });
  });

  return router;
}
