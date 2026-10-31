import { createAuthModule } from '@jerem-gt/ctrl-shared/server/auth';
import type { Mailer } from '@jerem-gt/ctrl-shared/server/mailer';
import { SQLiteSessionStore } from '@jerem-gt/ctrl-shared/server/session-store';
import type { SetupToken } from '@jerem-gt/ctrl-shared/server/setup';
import type { Database } from 'better-sqlite3';
import compression from 'compression';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';

import { type AuthLogger, globalErrorHandler, requestLogger } from './logger.js';
import { createAccountTypesRouter } from './modules/account-types/account-types.routes.js';
import { cashAuthOptions, SESSION_COOKIE } from './modules/accounts/accounts.js';
import { createAccountsRouter } from './modules/accounts/accounts.routes.js';
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
import { createDocsRouter } from './openapi/router.js';

export interface AppOptions {
  sessionSecret?: string;
  secureCookies?: boolean;
  backupDir?: string;
  /** Check de santé supplémentaire : renvoie une raison d'échec, ou null si OK. */
  healthExtraCheck?: () => string | null;
  /** Envoi d'e-mails (par défaut : config SMTP_* de l'environnement). */
  mailer?: Mailer;
  /** Jeton de premier démarrage (par défaut : nouveau jeton aléatoire). */
  setupToken?: SetupToken;
  /** URL publique de l'application pour les liens des e-mails (par défaut : APP_URL). */
  appUrl?: string;
  /** Journal des événements d'authentification (par défaut : logger). */
  authLogger?: AuthLogger;
}

function normalizeAppUrl(url: string | undefined): string | undefined {
  let trimmed = url?.trim() ?? '';
  while (trimmed.endsWith('/')) trimmed = trimmed.slice(0, -1);
  return trimmed || undefined;
}

function resolveSessionSecret(secret: string | undefined): string {
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test-secret';
  }
  throw new Error('createApp: sessionSecret is required outside NODE_ENV=test');
}

export function createApp(db: Database, options?: AppOptions): express.Application {
  const sessionSecret = resolveSessionSecret(options?.sessionSecret);
  const sessionStore = new SQLiteSessionStore(db);
  const app = express();

  app.use(helmet());
  app.use(compression());
  // Parseur 10 Mo dédié aux imports, monté avant le parseur global (body-parser ignore un corps déjà parsé).
  app.use('/api/import', express.json({ limit: '10mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);

  app.use(
    session({
      name: SESSION_COOKIE,
      store: sessionStore,
      secret: sessionSecret,
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
    } catch {
      res.status(503).json({ ok: false, reason: 'db' });
      return;
    }
    const reason = options?.healthExtraCheck?.() ?? null;
    if (reason === null) {
      res.json({ ok: true });
    } else {
      res.status(503).json({ ok: false, reason });
    }
  });

  app.get('/api/version', (_req, res) => {
    res.json({
      version: process.env.APP_VERSION || 'development',
    });
  });

  const auth = createAuthModule(
    db,
    sessionStore,
    cashAuthOptions(db, {
      secureCookies: options?.secureCookies,
      mailer: options?.mailer,
      setupToken: options?.setupToken,
      appUrl: normalizeAppUrl(options?.appUrl ?? process.env.APP_URL),
      log: options?.authLogger,
      backupDir: options?.backupDir,
    }),
  );
  app.use('/api/auth', auth.authRouter);
  app.use('/api/users', auth.usersRouter);
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
