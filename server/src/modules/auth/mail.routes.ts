import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import type { Mailer } from '../../lib/mailer.js';
import { MAIL_TEXTS } from '../../lib/mailTexts.js';
import { sendError } from '../../lib/routeHelpers.js';
import type { AuthLogger } from '../../logger.js';
import { createRequireAdmin, requireAuth, sessionUserId } from '../../middleware.js';
import type { AuthRepo } from './auth.repo.js';

export interface MailRouterDeps {
  db: Database;
  repo: AuthRepo;
  mailer: Mailer;
  log: AuthLogger;
}

export function createMailRouter(deps: MailRouterDeps): Router {
  const { db, repo, mailer, log } = deps;
  const router = Router();
  const requireAdmin = createRequireAdmin(db);

  router.post('/test-email', requireAuth, requireAdmin, async (req, res) => {
    const user = repo.getById(sessionUserId(req));
    if (!user?.email) {
      sendError(res, 400, 'auth.email_missing');
      return;
    }
    if (!mailer.isConfigured()) {
      sendError(res, 503, 'auth.smtp_not_configured');
      return;
    }
    try {
      await mailer.send({
        to: user.email,
        subject: 'CashCtrl',
        text: `${MAIL_TEXTS.fr.test}\n\n${MAIL_TEXTS.en.test}`,
      });
    } catch (err) {
      log.error(`Envoi de l'e-mail de test échoué : ${String(err)}`);
      sendError(res, 502, 'auth.email_send_failed');
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
