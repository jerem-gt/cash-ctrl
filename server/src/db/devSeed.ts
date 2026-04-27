import fs from 'node:fs';
import path from 'node:path';

import { createDb, DATA_DIR, initDatabase } from './init';

// ── Reset ─────────────────────────────────────────────────────────────────────
const DB_PATH = path.join(DATA_DIR, 'cashctrl.db');

if (fs.existsSync(DB_PATH)) {
  try {
    fs.rmSync(DB_PATH);
    console.log('Ancienne base supprimée.');
  } catch {
    console.error(
      'Impossible de supprimer la base (serveur en cours ?).\nArrête le serveur de dev puis relance db:reset:dev.',
    );
    process.exit(1);
  }
}

const db = createDb();
initDatabase(db);
console.log('Schéma et données de référence initialisés.');

// ── Helpers ───────────────────────────────────────────────────────────────────
function lookupId(table: string, name: string): number {
  const row = db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`${table} : "${name}" introuvable`);
  return row.id;
}

const USER_ID = 1;

const bankBNP = lookupId('banks', 'BNP Paribas');
const bankBourso = lookupId('banks', 'BoursoBank');
const bankCA = lookupId('banks', 'Crédit Agricole');
const bankRevolut = lookupId('banks', 'Revolut');

const typeCourant = lookupId('account_types', 'Courant');
const typeLivret = lookupId('account_types', 'Livret');
const typeEpargne = lookupId('account_types', 'Épargne');
const typeAutre = lookupId('account_types', 'Autre');

const subcatSalaire = lookupId('subcategories', 'Salaire');
const subcatLoyer = lookupId('subcategories', 'Loyer');
const subcatElec = lookupId('subcategories', 'Électricité');
const subcatSupermarche = lookupId('subcategories', 'Supermarché');
const subcatRestaurant = lookupId('subcategories', 'Restaurant');
const subcatStreaming = lookupId('subcategories', 'Streaming');
const subcatBTM = lookupId('subcategories', 'Bus/Tram/Metro');
const subcatPharmacie = lookupId('subcategories', 'Pharmacie');
const subcatInterets = lookupId('subcategories', 'Intérêts');
const subcatVetements = lookupId('subcategories', 'Vêtements');
const subcatVTC = lookupId('subcategories', 'VTC');
const subcatVacances = lookupId('subcategories', 'Vacances');
const subcatCinema = lookupId('subcategories', 'Cinéma');
const subcatAutre = lookupId('subcategories', 'Autre');

const subcatTransfert = lookupId('subcategories', 'Transfert');

const pmVirement = lookupId('payment_methods', 'Virement');
const pmCB = lookupId('payment_methods', 'Carte Bancaire');
const pmPrelevement = lookupId('payment_methods', 'Prélèvement');
const pmTransfert = lookupId('payment_methods', 'Transfert');

// ── Comptes ───────────────────────────────────────────────────────────────────
function insertAccount(
  name: string,
  bank_id: number,
  account_type_id: number,
  initial_balance: number,
  opening_date: string,
): number {
  const stmt = db.prepare(`
        INSERT INTO accounts (user_id, name, bank_id, account_type_id, initial_balance, opening_date)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
  return Number(
    stmt.run(USER_ID, name, bank_id, account_type_id, initial_balance, opening_date)
      .lastInsertRowid,
  );
}

// Deux comptes chez BNP (même banque), puis 3 banques différentes
const accBNPCourant = insertAccount('Compte BNP', bankBNP, typeCourant, 500, '2022-01-10');
const accBNPLivret = insertAccount('Livret A BNP', bankBNP, typeLivret, 1000, '2022-01-10');
const accBourso = insertAccount('Compte Bourso', bankBourso, typeCourant, 200, '2023-03-15');
const accCA = insertAccount('Épargne CA', bankCA, typeEpargne, 5000, '2020-06-01');
const accRevolut = insertAccount('Revolut', bankRevolut, typeAutre, 0, '2024-01-01');

// ── Transactions ──────────────────────────────────────────────────────────────
type TxInput = {
  account_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number;
  date: string;
  payment_method_id: number;
  validated: 0 | 1;
  notes?: string | null;
};

const stmtTx = db.prepare(`
    INSERT INTO transactions
        (user_id, account_id, type, amount, description, subcategory_id,
         date, payment_method_id, validated, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function insertTx(tx: TxInput): number {
  return Number(
    stmtTx.run(
      USER_ID,
      tx.account_id,
      tx.type,
      tx.amount,
      tx.description,
      tx.subcategory_id,
      tx.date,
      tx.payment_method_id,
      tx.validated,
      tx.notes ?? null,
    ).lastInsertRowid,
  );
}

const stmtLink = db.prepare('UPDATE transactions SET transfer_peer_id = ? WHERE id = ?');

function insertTransfer(
  fromAcc: number,
  toAcc: number,
  amount: number,
  descFrom: string,
  descTo: string,
  date: string,
): void {
  const a = insertTx({
    account_id: fromAcc,
    type: 'expense',
    amount,
    description: descFrom,
    subcategory_id: subcatTransfert,
    date,
    payment_method_id: pmTransfert,
    validated: 1,
  });
  const b = insertTx({
    account_id: toAcc,
    type: 'income',
    amount,
    description: descTo,
    subcategory_id: subcatTransfert,
    date,
    payment_method_id: pmTransfert,
    validated: 1,
  });
  stmtLink.run(b, a);
  stmtLink.run(a, b);
}

// BNP Courant — revenus + dépenses courantes
insertTx({
  account_id: accBNPCourant,
  type: 'income',
  amount: 2800,
  description: 'Salaire mars',
  subcategory_id: subcatSalaire,
  date: '2026-03-01',
  payment_method_id: pmVirement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'income',
  amount: 2800,
  description: 'Salaire avril',
  subcategory_id: subcatSalaire,
  date: '2026-04-01',
  payment_method_id: pmVirement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 850,
  description: 'Loyer mars',
  subcategory_id: subcatLoyer,
  date: '2026-03-05',
  payment_method_id: pmVirement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 850,
  description: 'Loyer avril',
  subcategory_id: subcatLoyer,
  date: '2026-04-05',
  payment_method_id: pmVirement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 65,
  description: 'EDF mars',
  subcategory_id: subcatElec,
  date: '2026-03-10',
  payment_method_id: pmPrelevement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 65,
  description: 'EDF avril',
  subcategory_id: subcatElec,
  date: '2026-04-10',
  payment_method_id: pmPrelevement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 78.5,
  description: 'Carrefour',
  subcategory_id: subcatSupermarche,
  date: '2026-03-08',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 45.2,
  description: 'Lidl',
  subcategory_id: subcatSupermarche,
  date: '2026-03-20',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 92.3,
  description: 'Leclerc',
  subcategory_id: subcatSupermarche,
  date: '2026-04-12',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 38,
  description: 'Restaurant Le Zinc',
  subcategory_id: subcatRestaurant,
  date: '2026-04-19',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 22.5,
  description: 'Pharmacie',
  subcategory_id: subcatPharmacie,
  date: '2026-03-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 15,
  description: 'Taxi',
  subcategory_id: subcatVTC,
  date: '2026-04-08',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 120,
  description: 'Vêtements Uniqlo',
  subcategory_id: subcatVetements,
  date: '2026-04-22',
  payment_method_id: pmCB,
  validated: 0,
});

// BNP Livret A — intérêts
insertTx({
  account_id: accBNPLivret,
  type: 'income',
  amount: 18.45,
  description: 'Intérêts 2025',
  subcategory_id: subcatInterets,
  date: '2026-01-01',
  payment_method_id: pmVirement,
  validated: 1,
});

// BoursoBank — abonnements + transport
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 15.99,
  description: 'Netflix',
  subcategory_id: subcatStreaming,
  date: '2026-03-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 9.99,
  description: 'Spotify',
  subcategory_id: subcatStreaming,
  date: '2026-03-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 86.4,
  description: 'Pass Navigo',
  subcategory_id: subcatBTM,
  date: '2026-03-03',
  payment_method_id: pmPrelevement,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 52,
  description: 'Cinéma + dîner',
  subcategory_id: subcatCinema,
  date: '2026-04-05',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 15.99,
  description: 'Netflix',
  subcategory_id: subcatStreaming,
  date: '2026-04-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 9.99,
  description: 'Spotify',
  subcategory_id: subcatStreaming,
  date: '2026-04-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 86.4,
  description: 'Pass Navigo',
  subcategory_id: subcatBTM,
  date: '2026-04-01',
  payment_method_id: pmPrelevement,
  validated: 1,
});

// Crédit Agricole — épargne
insertTx({
  account_id: accCA,
  type: 'income',
  amount: 112,
  description: 'Intérêts 2025',
  subcategory_id: subcatInterets,
  date: '2026-01-01',
  payment_method_id: pmVirement,
  validated: 1,
});

// Revolut — voyage
insertTx({
  account_id: accRevolut,
  type: 'expense',
  amount: 320,
  description: 'Airbnb Amsterdam',
  subcategory_id: subcatVacances,
  date: '2026-03-22',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accRevolut,
  type: 'expense',
  amount: 45.8,
  description: 'Alimentation voyage',
  subcategory_id: subcatRestaurant,
  date: '2026-03-23',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accRevolut,
  type: 'income',
  amount: 60,
  description: 'Remboursement Pierre',
  subcategory_id: subcatAutre,
  date: '2026-04-01',
  payment_method_id: pmVirement,
  validated: 1,
});

// Virements entre comptes (chaque compte impliqué dans au moins un)
insertTransfer(
  accBNPCourant,
  accBNPLivret,
  300,
  'Épargne → Livret A',
  'Virement entrant BNP',
  '2026-03-28',
);
insertTransfer(
  accBNPCourant,
  accBNPLivret,
  300,
  'Épargne → Livret A',
  'Virement entrant BNP',
  '2026-04-28',
);
insertTransfer(
  accBNPCourant,
  accBourso,
  200,
  'Virement vers Bourso',
  'Virement entrant BNP',
  '2026-03-02',
);
insertTransfer(
  accCA,
  accRevolut,
  400,
  'Budget voyage Amsterdam',
  'Virement depuis CA',
  '2026-03-20',
);

// ── Planifications ────────────────────────────────────────────────────────────
const stmtSched = db.prepare(`
    INSERT INTO scheduled_transactions
        (user_id, account_id, to_account_id, type, amount, description,
         subcategory_id, payment_method_id, notes, recurrence_unit, recurrence_interval,
         recurrence_day, recurrence_month, weekend_handling, start_date, end_date, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

type SchedInput = {
  account_id: number;
  to_account_id: number | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  subcategory_id: number;
  payment_method_id: number;
  notes: string | null;
  recurrence_unit: 'day' | 'week' | 'month' | 'year';
  recurrence_interval: number;
  recurrence_day: number | null;
  recurrence_month: number | null;
  weekend_handling: 'allow' | 'before' | 'after';
  start_date: string;
  end_date: string | null;
  active: 0 | 1;
};

function insertScheduled(s: SchedInput): void {
  stmtSched.run(
    USER_ID,
    s.account_id,
    s.to_account_id,
    s.type,
    s.amount,
    s.description,
    s.subcategory_id,
    s.payment_method_id,
    s.notes,
    s.recurrence_unit,
    s.recurrence_interval,
    s.recurrence_day,
    s.recurrence_month,
    s.weekend_handling,
    s.start_date,
    s.end_date,
    s.active,
  );
}

// Salaire le 1er du mois
insertScheduled({
  account_id: accBNPCourant,
  to_account_id: null,
  type: 'income',
  amount: 2800,
  description: 'Salaire',
  subcategory_id: subcatSalaire,
  payment_method_id: pmVirement,
  notes: null,
  recurrence_unit: 'month',
  recurrence_interval: 1,
  recurrence_day: 1,
  recurrence_month: null,
  weekend_handling: 'allow',
  start_date: '2024-01-01',
  end_date: null,
  active: 1,
});
// Loyer le 5
insertScheduled({
  account_id: accBNPCourant,
  to_account_id: null,
  type: 'expense',
  amount: 850,
  description: 'Loyer',
  subcategory_id: subcatLoyer,
  payment_method_id: pmVirement,
  notes: null,
  recurrence_unit: 'month',
  recurrence_interval: 1,
  recurrence_day: 5,
  recurrence_month: null,
  weekend_handling: 'allow',
  start_date: '2022-01-10',
  end_date: null,
  active: 1,
});
// EDF le 10
insertScheduled({
  account_id: accBNPCourant,
  to_account_id: null,
  type: 'expense',
  amount: 65,
  description: 'EDF',
  subcategory_id: subcatElec,
  payment_method_id: pmPrelevement,
  notes: null,
  recurrence_unit: 'month',
  recurrence_interval: 1,
  recurrence_day: 10,
  recurrence_month: null,
  weekend_handling: 'allow',
  start_date: '2022-01-10',
  end_date: null,
  active: 1,
});
// Virement épargne le 28 (transfert planifié BNP → Livret A)
insertScheduled({
  account_id: accBNPCourant,
  to_account_id: accBNPLivret,
  type: 'expense',
  amount: 300,
  description: 'Épargne mensuelle',
  subcategory_id: subcatTransfert,
  payment_method_id: pmTransfert,
  notes: null,
  recurrence_unit: 'month',
  recurrence_interval: 1,
  recurrence_day: 28,
  recurrence_month: null,
  weekend_handling: 'allow',
  start_date: '2022-01-28',
  end_date: null,
  active: 1,
});
// Netflix le 15 (Bourso)
insertScheduled({
  account_id: accBourso,
  to_account_id: null,
  type: 'expense',
  amount: 15.99,
  description: 'Netflix',
  subcategory_id: subcatStreaming,
  payment_method_id: pmCB,
  notes: null,
  recurrence_unit: 'month',
  recurrence_interval: 1,
  recurrence_day: 15,
  recurrence_month: null,
  weekend_handling: 'allow',
  start_date: '2023-03-15',
  end_date: null,
  active: 1,
});
// Pass Navigo le 1er, décalé au lundi si week-end (Bourso)
insertScheduled({
  account_id: accBourso,
  to_account_id: null,
  type: 'expense',
  amount: 86.4,
  description: 'Pass Navigo',
  subcategory_id: subcatBTM,
  payment_method_id: pmPrelevement,
  notes: null,
  recurrence_unit: 'month',
  recurrence_interval: 1,
  recurrence_day: 1,
  recurrence_month: null,
  weekend_handling: 'after',
  start_date: '2023-03-15',
  end_date: null,
  active: 1,
});

console.log('Jeu de données de développement chargé.');
console.log('  Comptes      : 5 (BNP x2, BoursoBank, Crédit Agricole, Revolut)');
console.log('  Transactions : 34 (dont 8 dans 4 virements liés)');
console.log('  Planifications: 6');
console.log('  Identifiants : admin / changeme');
