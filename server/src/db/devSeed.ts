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

const catAlim = lookupId('categories', 'Alimentation');
const catLoyer = lookupId('categories', 'Loyer');
const catTransp = lookupId('categories', 'Transport');
const catSante = lookupId('categories', 'Santé');
const catLoisi = lookupId('categories', 'Loisirs');
const catAbo = lookupId('categories', 'Abonnements');
const catSalaire = lookupId('categories', 'Salaire');
const catEpargne = lookupId('categories', 'Épargne');
const catTransfert = lookupId('categories', 'Transfert');
const catAutre = lookupId('categories', 'Autre');

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
  category_id: number;
  date: string;
  payment_method_id: number;
  validated: 0 | 1;
  notes?: string | null;
};

const stmtTx = db.prepare(`
    INSERT INTO transactions
        (user_id, account_id, type, amount, description, category_id,
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
      tx.category_id,
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
    category_id: catTransfert,
    date,
    payment_method_id: pmTransfert,
    validated: 1,
  });
  const b = insertTx({
    account_id: toAcc,
    type: 'income',
    amount,
    description: descTo,
    category_id: catTransfert,
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
  category_id: catSalaire,
  date: '2026-03-01',
  payment_method_id: pmVirement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'income',
  amount: 2800,
  description: 'Salaire avril',
  category_id: catSalaire,
  date: '2026-04-01',
  payment_method_id: pmVirement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 850,
  description: 'Loyer mars',
  category_id: catLoyer,
  date: '2026-03-05',
  payment_method_id: pmVirement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 850,
  description: 'Loyer avril',
  category_id: catLoyer,
  date: '2026-04-05',
  payment_method_id: pmVirement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 65,
  description: 'EDF mars',
  category_id: catAbo,
  date: '2026-03-10',
  payment_method_id: pmPrelevement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 65,
  description: 'EDF avril',
  category_id: catAbo,
  date: '2026-04-10',
  payment_method_id: pmPrelevement,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 78.5,
  description: 'Carrefour',
  category_id: catAlim,
  date: '2026-03-08',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 45.2,
  description: 'Lidl',
  category_id: catAlim,
  date: '2026-03-20',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 92.3,
  description: 'Leclerc',
  category_id: catAlim,
  date: '2026-04-12',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 38,
  description: 'Restaurant Le Zinc',
  category_id: catLoisi,
  date: '2026-04-19',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 22.5,
  description: 'Pharmacie',
  category_id: catSante,
  date: '2026-03-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 15,
  description: 'Taxi',
  category_id: catTransp,
  date: '2026-04-08',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBNPCourant,
  type: 'expense',
  amount: 120,
  description: 'Vêtements Uniqlo',
  category_id: catAutre,
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
  category_id: catEpargne,
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
  category_id: catAbo,
  date: '2026-03-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 9.99,
  description: 'Spotify',
  category_id: catAbo,
  date: '2026-03-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 86.4,
  description: 'Pass Navigo',
  category_id: catTransp,
  date: '2026-03-03',
  payment_method_id: pmPrelevement,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 52,
  description: 'Cinéma + dîner',
  category_id: catLoisi,
  date: '2026-04-05',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 15.99,
  description: 'Netflix',
  category_id: catAbo,
  date: '2026-04-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 9.99,
  description: 'Spotify',
  category_id: catAbo,
  date: '2026-04-15',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accBourso,
  type: 'expense',
  amount: 86.4,
  description: 'Pass Navigo',
  category_id: catTransp,
  date: '2026-04-01',
  payment_method_id: pmPrelevement,
  validated: 1,
});

// Crédit Agricole — épargne
insertTx({
  account_id: accCA,
  type: 'income',
  amount: 2000,
  description: 'Versement initial',
  category_id: catEpargne,
  date: '2020-06-01',
  payment_method_id: pmVirement,
  validated: 1,
});
insertTx({
  account_id: accCA,
  type: 'income',
  amount: 112,
  description: 'Intérêts 2025',
  category_id: catEpargne,
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
  category_id: catLoisi,
  date: '2026-03-22',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accRevolut,
  type: 'expense',
  amount: 45.8,
  description: 'Alimentation voyage',
  category_id: catAlim,
  date: '2026-03-23',
  payment_method_id: pmCB,
  validated: 1,
});
insertTx({
  account_id: accRevolut,
  type: 'income',
  amount: 60,
  description: 'Remboursement Pierre',
  category_id: catAutre,
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
         category_id, payment_method_id, notes, recurrence_unit, recurrence_interval,
         recurrence_day, recurrence_month, weekend_handling, start_date, end_date, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

type SchedInput = {
  account_id: number;
  to_account_id: number | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: number;
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
    s.category_id,
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
  category_id: catSalaire,
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
  category_id: catLoyer,
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
  category_id: catAbo,
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
  category_id: catTransfert,
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
  category_id: catAbo,
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
  category_id: catTransp,
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
