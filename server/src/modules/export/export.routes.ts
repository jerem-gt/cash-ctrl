import { Router } from 'express';
import { requireAuth } from '../../middleware.js';
import { createExportRepo } from './export.repo';
import type { Database } from 'better-sqlite3';

export function createExportRouter(db: Database): Router {
  const exportRepo = createExportRepo(db);
  const router = Router();
  router.use(requireAuth);

  router.get('/csv', (req, res) => {
    const rows = exportRepo.getCsvRows(req.session.userId!);

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
    const userId = req.session.userId!;
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="cashctrl-backup-${date}.json"`);
    res.json({
      exported_at: new Date().toISOString(),
      accounts: exportRepo.getAccounts(userId),
      transactions: exportRepo.getTransactions(userId),
    });
  });

  return router;
}
