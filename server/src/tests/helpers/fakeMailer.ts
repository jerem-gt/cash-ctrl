import type { Mailer, MailMessage } from '@jerem-gt/ctrl-shared/server/mailer';

export interface FakeMailer extends Mailer {
  sent: MailMessage[];
}

/** Mailer de test : mémorise les messages, aucun SMTP réel. */
export function createFakeMailer(
  options: { configured?: boolean; fail?: boolean } = {},
): FakeMailer {
  const { configured = true, fail = false } = options;
  const sent: MailMessage[] = [];
  return {
    sent,
    isConfigured: () => configured,
    send: (message) => {
      if (fail) return Promise.reject(new Error('smtp down'));
      sent.push(message);
      return Promise.resolve();
    },
  };
}
