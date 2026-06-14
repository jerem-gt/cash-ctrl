import type { Database } from 'better-sqlite3';

const DEFAULT_BANKS: { name: string; login_url: string | null }[] = [
  { name: 'BoursoBank', login_url: 'https://clients.boursobank.com/connexion' },
  { name: 'Fortuneo', login_url: 'https://mabanque.fortuneo.fr/mon-espace' },
  {
    name: 'Crédit Agricole',
    login_url: 'https://www.credit-agricole.fr/ca-nord-est/particulier/acceder-a-mes-comptes.html',
  },
  { name: 'Linxea', login_url: 'https://espaceclient.linxea.com/authentification' },
  { name: 'Amundi', login_url: 'https://epargnant.amundi-ee.com/#/connexion' },
  { name: 'BNP Paribas', login_url: 'https://mabanque.bnpparibas/fr/connexion' },
  { name: 'Société Générale', login_url: 'https://particuliers.sg.fr/icd/cns/index-authsec.html' },
  { name: 'Revolut', login_url: 'https://app.revolut.com/start' },
  { name: 'N26', login_url: 'https://app.n26.com/login' },
  { name: 'Hello Bank!', login_url: 'https://www.hellobank.fr/fr/client' },
  { name: 'BforBank', login_url: 'https://www.bforbank.com/login' },
  { name: 'Monabanq', login_url: 'https://www.monabanq.com/fr/login.html' },
  { name: 'ING', login_url: 'https://www.monabanq.com/fr/identification/authentification.html' },
  { name: 'Bourse Direct', login_url: 'https://www.boursedirect.fr/fr/login' },
  { name: 'Soon', login_url: null },
  { name: 'Orange Bank', login_url: 'https://www.orangeobk.fr' },
  {
    name: 'Crédit du Nord',
    login_url: 'https://particuliers.sg.fr/icd/cbo/index-react-authsec.html',
  },
  { name: 'Natixis', login_url: 'https://epargnants.interepargne.natixis.fr/front/dashboard' },
];

export function seedBanks(db: Database) {
  const stmt = db.prepare(`
    INSERT INTO banks (name, logo, login_url)
    VALUES (?, NULL, ?)
    ON CONFLICT(name) DO UPDATE SET login_url = excluded.login_url
  `);

  db.transaction(() => {
    for (const { name, login_url } of DEFAULT_BANKS) {
      stmt.run(name, login_url);
    }
  })();
}
