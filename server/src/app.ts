import type { Database } from 'better-sqlite3';
import express from 'express';
import session from 'express-session';

import { globalErrorHandler, requestLogger } from './logger';
import { createAccountTypesRouter } from './modules/account-types/account-types.routes';
import { createAccountsRouter } from './modules/accounts/accounts.routes';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createBanksRouter } from './modules/banks/banks.routes';
import { createCategoriesRouter } from './modules/categories/categories.routes';
import { createExportRouter } from './modules/export/export.routes';
import { createPaymentMethodsRouter } from './modules/payment-methods/payment-methods.routes';
import { createScheduledRouter } from './modules/scheduled/scheduled.routes';
import { createSettingsRouter } from './modules/settings/settings.routes';
import { createSubcategoriesRouter } from './modules/subcategories/subcategories.routes';
import { createTransactionsRouter } from './modules/transactions/transactions.routes';
import { createTransfersRouter } from './modules/transfers/transfers.routes';
import { SQLiteSessionStore } from './session-store.js';

export interface AppOptions {
  sessionSecret?: string;
  secureCookies?: boolean;
}

export function createApp(db: Database, options?: AppOptions): express.Application {
  const app = express();

  app.use(express.json());
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
        secure: options?.secureCookies ?? false,
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

  app.get('/api/version', (req, res) => {
    res.json({
      version: process.env.APP_VERSION || 'development',
    });
  });

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/accounts', createAccountsRouter(db));
  app.use('/api/transactions', createTransactionsRouter(db));
  app.use('/api/transfers', createTransfersRouter(db));
  app.use('/api/export', createExportRouter(db));
  app.use('/api/categories', createCategoriesRouter(db));
  app.use('/api/subcategories', createSubcategoriesRouter(db));
  app.use('/api/account-types', createAccountTypesRouter(db));
  app.use('/api/banks', createBanksRouter(db));
  app.use('/api/payment-methods', createPaymentMethodsRouter(db));
  app.use('/api/scheduled', createScheduledRouter(db));
  app.use('/api/settings', createSettingsRouter(db));

  app.use(globalErrorHandler);

  return app;
}
