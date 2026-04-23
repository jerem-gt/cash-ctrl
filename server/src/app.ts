import express from 'express';
import session from 'express-session';
import type Database from 'better-sqlite3';
import { SQLiteSessionStore } from './session-store.js';
import { createAuthRouter } from './routes/auth.js';
import { createAccountsRouter } from './routes/accounts.js';
import { createTransactionsRouter } from './routes/transactions.js';
import { createTransfersRouter } from './routes/transfers.js';
import { createExportRouter } from './routes/export.js';
import { createCategoriesRouter } from './routes/categories.js';
import { createAccountTypesRouter } from './routes/account-types.js';
import { createBanksRouter } from './routes/banks.js';
import { createPaymentMethodsRouter } from './routes/payment-methods.js';
import { createScheduledRouter } from './routes/scheduled.js';
import { createSettingsRouter } from './routes/settings.js';

export interface AppOptions {
  sessionSecret?: string;
  secureCookies?: boolean;
}

export function createApp(db: Database.Database, options?: AppOptions): express.Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
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
  }));

  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, reason: 'db' });
    }
  });

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/accounts', createAccountsRouter(db));
  app.use('/api/transactions', createTransactionsRouter(db));
  app.use('/api/transfers', createTransfersRouter(db));
  app.use('/api/export', createExportRouter(db));
  app.use('/api/categories', createCategoriesRouter(db));
  app.use('/api/account-types', createAccountTypesRouter(db));
  app.use('/api/banks', createBanksRouter(db));
  app.use('/api/payment-methods', createPaymentMethodsRouter(db));
  app.use('/api/scheduled', createScheduledRouter(db));
  app.use('/api/settings', createSettingsRouter(db));

  return app;
}
