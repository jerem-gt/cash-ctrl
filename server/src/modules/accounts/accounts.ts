import fs from 'node:fs';

import type { UserStats } from '@cashctrl/types';
import type { AuthLogger, AuthModuleOptions } from '@jerem-gt/ctrl-shared/server/auth';
import type { Mailer } from '@jerem-gt/ctrl-shared/server/mailer';
import type { SetupToken } from '@jerem-gt/ctrl-shared/server/setup';
import type { Database } from 'better-sqlite3';

import { seedUserData } from '../../db/seed.js';
import { BACKUP_DIR, userBackupDir } from '../../lib/backup.js';
import { HttpError } from '../../lib/errors.js';
import { MAIL_TEXTS } from '../../lib/mailTexts.js';
import type { Lang } from '../../lib/systemEntities.js';
import { logger } from '../../logger.js';

/** Nom par défaut d'express-session, gardé tel quel pour ne pas fermer les sessions ouvertes. */
export const SESSION_COOKIE = 'connect.sid';

/** Langues de l'interface : `lang` choisit les données initiales d'un compte et ses e-mails. */
export const LANGUAGES = ['fr', 'en'] as const satisfies readonly Lang[];

export interface AccountsOptions {
  secureCookies?: boolean;
  appUrl?: string;
  mailer?: Mailer;
  setupToken?: SetupToken;
  log?: AuthLogger;
  /** Racine des sauvegardes (`<backupDir>/<id du compte>`). */
  backupDir?: string;
}

/** Options du module d'auth de ctrl-shared propres à CashCtrl. */
export function cashAuthOptions(
  db: Database,
  options: AccountsOptions = {},
): AuthModuleOptions<Lang, UserStats> {
  const { backupDir = BACKUP_DIR, log = logger, ...auth } = options;
  const statsStmt = db.prepare<
    [number, number],
    { account_count: number; tx_count: number; last_tx_date: string | null }
  >(
    `SELECT (SELECT COUNT(*) FROM accounts WHERE user_id = ?) AS account_count,
            COUNT(*) AS tx_count, MAX(date) AS last_tx_date
     FROM transactions WHERE user_id = ?`,
  );

  return {
    appName: 'CashCtrl',
    HttpError,
    sessionCookie: SESSION_COOKIE,
    deviceCookie: 'cashctrl_device',
    languages: LANGUAGES,
    mailTexts: {
      reset: (lang, link, minutes) => ({
        subject: MAIL_TEXTS[lang].subject,
        text: MAIL_TEXTS[lang].reset(link, minutes),
      }),
      // La langue du compte n'est pas connue : le message est bilingue.
      test: () => ({ subject: 'CashCtrl', text: `${MAIL_TEXTS.fr.test}\n\n${MAIL_TEXTS.en.test}` }),
    },
    userStats: (userId) => {
      const row = statsStmt.get(userId, userId);
      return {
        accountCount: row?.account_count ?? 0,
        txCount: row?.tx_count ?? 0,
        lastTxDate: row?.last_tx_date ?? null,
      };
    },
    onUserCreated: seedUserData,
    // Les sauvegardes du compte supprimé ne restent pas sur le disque.
    onUserDeleted: (userId) => () =>
      fs.promises.rm(userBackupDir(backupDir, userId), { recursive: true, force: true }),
    log,
    ...auth,
  };
}
