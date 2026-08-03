import type { Database } from 'better-sqlite3';
import compression from 'compression';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';

import { globalErrorHandler, requestLogger } from './logger.js';
import { createAccountTypesRouter } from './modules/account-types/account-types.routes.js';
import { createAccountsRouter } from './modules/accounts/accounts.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createBackupRouter } from './modules/backup/backup.routes.js';
import { createBanksRouter } from './modules/banks/banks.routes.js';
import { createCategoriesRouter } from './modules/categories/categories.routes.js';
import { createCategorizationRulesRouter } from './modules/categorization-rules/categorization-rules.routes.js';
import { createExportRouter } from './modules/export/export.routes.js';
import { createImportRouter } from './modules/import/import.routes.js';
import { createInsuranceRouter } from './modules/insurance/insurance.routes.js';
import { createLoansRouter } from './modules/loans/loans.routes.js';
import { createPaymentMethodsRouter } from './modules/payment-methods/payment-methods.routes.js';
import { createReimbursementsRouter } from './modules/reimbursements/reimbursements.routes.js';
import { createScheduledRouter } from './modules/scheduled/scheduled.routes.js';
import { createSearchRouter } from './modules/search/search.routes.js';
import { createSettingsRouter } from './modules/settings/settings.routes.js';
import { createStatsRouter } from './modules/stats/stats.routes.js';
import { createStocksRouter } from './modules/stocks/stocks.routes.js';
import { createSubcategoriesRouter } from './modules/subcategories/subcategories.routes.js';
import { createTaxRouter } from './modules/tax/tax.routes.js';
import { createTransactionsRouter } from './modules/transactions/transactions.routes.js';
import { createTransfersRouter } from './modules/transfers/transfers.routes.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import { createDocsRouter } from './openapi/router.js';
import { SQLiteSessionStore } from './session-store.js';

export interface AppOptions {
  sessionSecret?: string;
  secureCookies?: boolean;
  backupDir?: string;
}

export function createApp(db: Database, options?: AppOptions): express.Application {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use(
    session({
      store: new SQLiteSessionStore(db),
      secret: options?.sessionSecret ?? 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: options?.secureCookies ? 'auto' : false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, reason: 'db' });
    }
  });

  app.get('/api/version', (_req, res) => {
    res.json({
      version: process.env.APP_VERSION || 'development',
    });
  });

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/users', createUsersRouter(db));
  app.use('/api/accounts', createAccountsRouter(db));
  app.use('/api/transactions', createTransactionsRouter(db));
  app.use('/api/transfers', createTransfersRouter(db));
  app.use('/api/reimbursements', createReimbursementsRouter(db));
  app.use('/api/backup', createBackupRouter(db, options?.backupDir));
  app.use('/api/export', createExportRouter(db));
  app.use('/api/import', createImportRouter(db));
  app.use('/api/categories', createCategoriesRouter(db));
  app.use('/api/subcategories', createSubcategoriesRouter(db));
  app.use('/api/account-types', createAccountTypesRouter(db));
  app.use('/api/banks', createBanksRouter(db));
  app.use('/api/payment-methods', createPaymentMethodsRouter(db));
  app.use('/api/scheduled', createScheduledRouter(db));
  app.use('/api/settings', createSettingsRouter(db));
  app.use('/api/stocks', createStocksRouter(db));
  app.use('/api/insurance', createInsuranceRouter(db));
  app.use('/api/loans', createLoansRouter(db));
  app.use('/api/stats', createStatsRouter(db));
  app.use('/api/tax', createTaxRouter(db));
  app.use('/api/categorization-rules', createCategorizationRulesRouter(db));
  app.use('/api/search', createSearchRouter(db));

  app.use('/api/docs', createDocsRouter());

  app.use(globalErrorHandler);

  return app;
}
