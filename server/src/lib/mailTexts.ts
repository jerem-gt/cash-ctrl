import type { MailTexts } from '@jerem-gt/ctrl-shared/server/auth';

import type { Lang } from './systemEntities.js';

const TEXTS: Record<
  Lang,
  { subject: string; reset: (link: string, minutes: number) => string; test: string }
> = {
  fr: {
    subject: 'CashCtrl : réinitialisation du mot de passe',
    reset: (link, minutes) =>
      `Bonjour,\n\nPour choisir un nouveau mot de passe CashCtrl, ouvrez ce lien (valable ${minutes} minutes) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    test: "Ceci est un e-mail de test : l'envoi depuis CashCtrl fonctionne.",
  },
  en: {
    subject: 'CashCtrl: password reset',
    reset: (link, minutes) =>
      `Hello,\n\nTo choose a new CashCtrl password, open this link (valid for ${minutes} minutes):\n${link}\n\nIf you did not request this, you can ignore this message.`,
    test: 'This is a test email: sending from CashCtrl works.',
  },
};

/** Textes des e-mails dans la langue demandée ; l'e-mail de test, sans langue connue, est bilingue. */
export const MAIL_TEXTS: MailTexts<Lang> = {
  reset: (lang, link, minutes) => ({
    subject: TEXTS[lang].subject,
    text: TEXTS[lang].reset(link, minutes),
  }),
  test: () => ({
    subject: 'CashCtrl',
    text: `${TEXTS.fr.test}

${TEXTS.en.test}`,
  }),
};
