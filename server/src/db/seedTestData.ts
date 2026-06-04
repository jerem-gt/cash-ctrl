import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';

import {
  RecurrenceUnit,
  ReimbursementStatus,
  TransactionType,
  WeekendHandling,
} from '../constants';
import { dateStr } from '../lib/dateUtils';
import { toCents } from '../lib/money';
import { createInsuranceRepo } from '../modules/insurance/insurance.repo';
import { createLoansRepo } from '../modules/loans/loans.repo';
import { createStocksRepo } from '../modules/stocks/stocks.repo';
import { createTransfersRepo } from '../modules/transfers/transfers.repo';
import { createDb, DATA_DIR } from './init';
import { seedUserData } from './seed';

export function seedTestData(db: Database) {
  // ── Réinitialisation du compte test (cascade sur toutes ses données) ────────
  db.prepare("DELETE FROM users WHERE username = 'test'").run();

  const testHash = bcrypt.hashSync('test', 12);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('test', testHash);
  const testUser = db.prepare("SELECT id FROM users WHERE username = 'test'").get() as {
    id: number;
  };
  const USER_ID = testUser.id;
  seedUserData(db, USER_ID);

  // ── Ancre temporelle ─────────────────────────────────────────────────────────
  // Les dates « récentes » (salaires, charges, achats du trimestre) sont calculées
  // par rapport à aujourd'hui pour que le compte démo reste frais à chaque (re)seed
  // — sinon les KPI « mois courant / vs mois dernier » se vident avec le temps.
  // L'historique profond (ouvertures, vieux achats Bourse/AV) utilise `yearsAgo`
  // pour rester crédible sans dénaturer les PRU.
  // SEED_TODAY=YYYY-MM-DD permet de figer l'ancre pour un seed reproductible.
  const TODAY = process.env.SEED_TODAY ? new Date(process.env.SEED_TODAY) : new Date();

  /** Date ISO à `monthOffset` mois d'aujourd'hui, jour `day` (clampé à la fin du mois). */
  function monthDay(monthOffset: number, day: number): string {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() + monthOffset, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return dateStr(d);
  }

  /** Date ISO à `years` années d'aujourd'hui (historique : ouvertures, vieux achats). */
  function yearsAgo(years: number, month = 0, day = 1): string {
    return dateStr(new Date(TODAY.getFullYear() - years, month, day));
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function lookupId(table: string, name: string): number {
    const row = db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name) as
      | { id: number }
      | undefined;
    if (!row) throw new Error(`${table} : "${name}" introuvable`);
    return row.id;
  }

  function lookupUserScopedId(table: string, name: string): number {
    const row = db
      .prepare(`SELECT id FROM ${table} WHERE name = ? AND user_id = ?`)
      .get(name, USER_ID) as { id: number } | undefined;
    if (!row) throw new Error(`${table} : "${name}" introuvable pour user ${USER_ID}`);
    return row.id;
  }

  const bankBNP = lookupId('banks', 'BNP Paribas');
  const bankBourso = lookupId('banks', 'BoursoBank');
  const bankCA = lookupId('banks', 'Crédit Agricole');
  const bankRevolut = lookupId('banks', 'Revolut');
  const bankLinxea = lookupId('banks', 'Linxea');

  const typeCourant = lookupUserScopedId('account_types', 'Courant');
  const typeEpargne = lookupUserScopedId('account_types', 'Épargne');
  const typeBourse = lookupUserScopedId('account_types', 'Bourse');
  const typeAutre = lookupUserScopedId('account_types', 'Autre');
  const typeAV = lookupUserScopedId('account_types', 'Assurance Vie');
  const typePER = lookupUserScopedId('account_types', 'PER');

  const subcatSalaire = lookupUserScopedId('subcategories', 'Salaire');
  const subcatLoyer = lookupUserScopedId('subcategories', 'Loyer');
  const subcatElec = lookupUserScopedId('subcategories', 'Électricité');
  const subcatSupermarche = lookupUserScopedId('subcategories', 'Supermarché');
  const subcatRestaurant = lookupUserScopedId('subcategories', 'Restaurant');
  const subcatStreaming = lookupUserScopedId('subcategories', 'Streaming');
  const subcatBTM = lookupUserScopedId('subcategories', 'Bus/Tram/Metro');
  const subcatPharmacie = lookupUserScopedId('subcategories', 'Pharmacie');
  const subcatMedecin = lookupUserScopedId('subcategories', 'Médecin');
  const subcatInterets = lookupUserScopedId('subcategories', 'Intérêts');
  const subcatVetements = lookupUserScopedId('subcategories', 'Vêtements');
  const subcatVTC = lookupUserScopedId('subcategories', 'VTC');
  const subcatVacances = lookupUserScopedId('subcategories', 'Vacances');
  const subcatCinema = lookupUserScopedId('subcategories', 'Cinéma');
  const subcatAutre = lookupUserScopedId('subcategories', 'Autre');
  const subcatTransfert = lookupUserScopedId('subcategories', 'Transfert');

  const pmVirement = lookupUserScopedId('payment_methods', 'Virement');
  const pmCB = lookupUserScopedId('payment_methods', 'Carte Bancaire');
  const pmPrelevement = lookupUserScopedId('payment_methods', 'Prélèvement');
  const pmTransfert = lookupUserScopedId('payment_methods', 'Transfert');

  // ── Comptes ──────────────────────────────────────────────────────────────────
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

  const accBNPCourant = insertAccount(
    'Compte BNP',
    bankBNP,
    typeCourant,
    toCents(500),
    yearsAgo(4, 0, 10),
  );
  const accBNPLivret = insertAccount(
    'Livret A BNP',
    bankBNP,
    typeEpargne,
    toCents(1000),
    yearsAgo(4, 0, 10),
  );
  const accBourso = insertAccount(
    'Compte Bourso',
    bankBourso,
    typeCourant,
    toCents(200),
    yearsAgo(3, 2, 15),
  );
  const accCA = insertAccount('Épargne CA', bankCA, typeEpargne, toCents(5000), yearsAgo(6, 5, 1));
  const accRevolut = insertAccount('Revolut', bankRevolut, typeAutre, 0, yearsAgo(2, 0, 1));
  const accPEA = insertAccount(
    'PEA BoursoBank',
    bankBourso,
    typeBourse,
    toCents(5000),
    yearsAgo(2, 0, 1),
  );
  const accAV = insertAccount('AV Linxea Spirit 2', bankLinxea, typeAV, 0, yearsAgo(2, 0, 15));
  const accPER = insertAccount('PER Linxea Spirit PER', bankLinxea, typePER, 0, yearsAgo(1, 1, 15));

  // Compte clôturé — illustre la gestion des comptes fermés (closed_at)
  const accClosed = insertAccount(
    'Livret Jeune (clôturé)',
    bankCA,
    typeEpargne,
    toCents(0),
    yearsAgo(8, 8, 1),
  );
  db.prepare('UPDATE accounts SET closed_at = ? WHERE id = ?').run(yearsAgo(3, 10, 30), accClosed);

  // ── Transactions ─────────────────────────────────────────────────────────────
  type TxInput = {
    account_id: number;
    type: TransactionType;
    amount: number;
    description: string;
    subcategory_id: number;
    date: string;
    payment_method_id: number;
    validated: 0 | 1;
    notes?: string | null;
    reimbursement_status?: ReimbursementStatus | null;
  };

  const stmtTx = db.prepare(`
      INSERT INTO transactions
          (user_id, account_id, type, amount, description, subcategory_id,
           date, payment_method_id, validated, notes, reimbursement_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  function insertTx(tx: TxInput): number {
    return Number(
      stmtTx.run(
        USER_ID,
        tx.account_id,
        tx.type,
        toCents(tx.amount),
        tx.description,
        tx.subcategory_id,
        tx.date,
        tx.payment_method_id,
        tx.validated,
        tx.notes ?? null,
        tx.reimbursement_status ?? null,
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

  // BNP Courant — revenus + dépenses courantes (mois -3 et -2)
  insertTx({
    account_id: accBNPCourant,
    type: 'income',
    amount: 2800,
    description: 'Salaire',
    subcategory_id: subcatSalaire,
    date: monthDay(-3, 1),
    payment_method_id: pmVirement,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'income',
    amount: 2800,
    description: 'Salaire',
    subcategory_id: subcatSalaire,
    date: monthDay(-2, 1),
    payment_method_id: pmVirement,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 850,
    description: 'Loyer',
    subcategory_id: subcatLoyer,
    date: monthDay(-3, 5),
    payment_method_id: pmVirement,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 850,
    description: 'Loyer',
    subcategory_id: subcatLoyer,
    date: monthDay(-2, 5),
    payment_method_id: pmVirement,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 65,
    description: 'EDF',
    subcategory_id: subcatElec,
    date: monthDay(-3, 10),
    payment_method_id: pmPrelevement,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 65,
    description: 'EDF',
    subcategory_id: subcatElec,
    date: monthDay(-2, 10),
    payment_method_id: pmPrelevement,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 78.5,
    description: 'Carrefour',
    subcategory_id: subcatSupermarche,
    date: monthDay(-3, 8),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 45.2,
    description: 'Lidl',
    subcategory_id: subcatSupermarche,
    date: monthDay(-3, 20),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 92.3,
    description: 'Leclerc',
    subcategory_id: subcatSupermarche,
    date: monthDay(-2, 12),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 38,
    description: 'Restaurant Le Zinc',
    subcategory_id: subcatRestaurant,
    date: monthDay(-2, 19),
    payment_method_id: pmCB,
    validated: 1,
  });
  const pharmacieId = insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 22.5,
    description: 'Pharmacie',
    subcategory_id: subcatPharmacie,
    date: monthDay(-3, 15),
    payment_method_id: pmCB,
    validated: 1,
    reimbursement_status: 'rembourse',
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 38,
    description: 'Consultation Dr. Martin',
    subcategory_id: subcatMedecin,
    date: monthDay(-2, 10),
    payment_method_id: pmCB,
    validated: 1,
    reimbursement_status: 'en_attente',
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 65,
    description: 'Dentiste',
    subcategory_id: subcatMedecin,
    date: monthDay(-2, 25),
    payment_method_id: pmCB,
    validated: 0,
    reimbursement_status: 'en_attente',
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 15,
    description: 'Taxi',
    subcategory_id: subcatVTC,
    date: monthDay(-2, 8),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 120,
    description: 'Vêtements Uniqlo',
    subcategory_id: subcatVetements,
    date: monthDay(-2, 22),
    payment_method_id: pmCB,
    validated: 0,
  });

  // ── Mois courant et précédent (offsets -1 et 0) ──────────────────────────────
  // Garde des données fraîches pour le mois en cours et le précédent
  // (le KPI dashboard « tendance vs mois dernier » a besoin des deux).
  const stmtSplit = db.prepare(
    'INSERT INTO transaction_splits (user_id, transaction_id, subcategory_id, amount) VALUES (?, ?, ?, ?)',
  );

  // Mois -1
  insertTx({
    account_id: accBNPCourant,
    type: 'income',
    amount: 2800,
    description: 'Salaire',
    subcategory_id: subcatSalaire,
    date: monthDay(-1, 1),
    payment_method_id: pmVirement,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 850,
    description: 'Loyer',
    subcategory_id: subcatLoyer,
    date: monthDay(-1, 5),
    payment_method_id: pmVirement,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 65,
    description: 'EDF',
    subcategory_id: subcatElec,
    date: monthDay(-1, 10),
    payment_method_id: pmPrelevement,
    validated: 1,
  });
  // Transaction ventilée : courses + textile sur le même ticket Carrefour
  const carrefourSplitId = insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 82,
    description: 'Carrefour (courses + textile)',
    subcategory_id: subcatSupermarche,
    date: monthDay(-1, 8),
    payment_method_id: pmCB,
    validated: 1,
  });
  stmtSplit.run(USER_ID, carrefourSplitId, subcatSupermarche, toCents(60));
  stmtSplit.run(USER_ID, carrefourSplitId, subcatVetements, toCents(22));

  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 42,
    description: 'Restaurant La Table',
    subcategory_id: subcatRestaurant,
    date: monthDay(-1, 17),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accBourso,
    type: 'expense',
    amount: 15.99,
    description: 'Netflix',
    subcategory_id: subcatStreaming,
    date: monthDay(-1, 15),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accBourso,
    type: 'expense',
    amount: 86.4,
    description: 'Pass Navigo',
    subcategory_id: subcatBTM,
    date: monthDay(-1, 1),
    payment_method_id: pmPrelevement,
    validated: 1,
  });

  // Mois en cours (offset 0)
  insertTx({
    account_id: accBNPCourant,
    type: 'income',
    amount: 2800,
    description: 'Salaire',
    subcategory_id: subcatSalaire,
    date: monthDay(0, 1),
    payment_method_id: pmVirement,
    validated: 1,
  });
  insertTx({
    account_id: accBNPCourant,
    type: 'expense',
    amount: 47.3,
    description: 'Lidl',
    subcategory_id: subcatSupermarche,
    date: monthDay(0, 1),
    payment_method_id: pmCB,
    validated: 1,
  });

  // BNP Livret A — intérêts annuels (mois -5)
  insertTx({
    account_id: accBNPLivret,
    type: 'income',
    amount: 18.45,
    description: 'Intérêts annuels',
    subcategory_id: subcatInterets,
    date: monthDay(-5, 1),
    payment_method_id: pmVirement,
    validated: 1,
  });

  // BoursoBank — abonnements + transport (mois -2)
  insertTx({
    account_id: accBourso,
    type: 'expense',
    amount: 52,
    description: 'Cinéma + dîner',
    subcategory_id: subcatCinema,
    date: monthDay(-2, 5),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accBourso,
    type: 'expense',
    amount: 15.99,
    description: 'Netflix',
    subcategory_id: subcatStreaming,
    date: monthDay(-2, 15),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accBourso,
    type: 'expense',
    amount: 9.99,
    description: 'Spotify',
    subcategory_id: subcatStreaming,
    date: monthDay(-2, 15),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accBourso,
    type: 'expense',
    amount: 86.4,
    description: 'Pass Navigo',
    subcategory_id: subcatBTM,
    date: monthDay(-2, 1),
    payment_method_id: pmPrelevement,
    validated: 1,
  });

  // Crédit Agricole — épargne (mois -5)
  insertTx({
    account_id: accCA,
    type: 'income',
    amount: 112,
    description: 'Intérêts annuels',
    subcategory_id: subcatInterets,
    date: monthDay(-5, 1),
    payment_method_id: pmVirement,
    validated: 1,
  });

  // Revolut — voyage (mois -3)
  insertTx({
    account_id: accRevolut,
    type: 'expense',
    amount: 320,
    description: 'Airbnb Amsterdam',
    subcategory_id: subcatVacances,
    date: monthDay(-3, 22),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accRevolut,
    type: 'expense',
    amount: 45.8,
    description: 'Alimentation voyage',
    subcategory_id: subcatRestaurant,
    date: monthDay(-3, 23),
    payment_method_id: pmCB,
    validated: 1,
  });
  insertTx({
    account_id: accRevolut,
    type: 'income',
    amount: 60,
    description: 'Remboursement Pierre',
    subcategory_id: subcatAutre,
    date: monthDay(-2, 1),
    payment_method_id: pmVirement,
    validated: 1,
  });

  // Virements entre comptes
  insertTransfer(
    accBNPCourant,
    accBNPLivret,
    300,
    'Épargne → Livret A',
    'Virement entrant BNP',
    monthDay(-3, 28),
  );
  insertTransfer(
    accBNPCourant,
    accBNPLivret,
    300,
    'Épargne → Livret A',
    'Virement entrant BNP',
    monthDay(-2, 28),
  );
  insertTransfer(
    accBNPCourant,
    accBourso,
    200,
    'Virement vers Bourso',
    'Virement entrant BNP',
    monthDay(-3, 2),
  );
  insertTransfer(
    accCA,
    accRevolut,
    400,
    'Budget voyage Amsterdam',
    'Virement depuis CA',
    monthDay(-3, 20),
  );

  // ── Remboursements ───────────────────────────────────────────────────────────
  const secuRembId = insertTx({
    account_id: accBNPCourant,
    type: 'income',
    amount: 15.75,
    description: 'Remboursement Sécu — Pharmacie',
    subcategory_id: subcatPharmacie,
    date: monthDay(-2, 1),
    payment_method_id: pmVirement,
    validated: 1,
  });
  // Remboursement partiel : la Sécu (15,75 €) ne couvre qu'une partie de la
  // dépense Pharmacie (22,50 €) → montant attribué explicite.
  db.prepare(
    'INSERT INTO reimbursements (user_id, transaction_id, linked_transaction_id, attributed_amount) VALUES (?, ?, ?, ?)',
  ).run(USER_ID, pharmacieId, secuRembId, toCents(15.75));

  // ── Bourse (PEA) ─────────────────────────────────────────────────────────────
  // On passe par le repo de production : chaque opération génère sa transaction
  // principale + une transaction de frais séparée (fees_transaction_id), exactement
  // comme via l'UI. recalcPosition recompute quantité + PRU à partir des opérations.
  const stocksRepo = createStocksRepo(db);

  function buyStock(
    accountId: number,
    ticker: string,
    quantity: number,
    pricePerShare: number,
    fees: number,
    date: string,
  ): void {
    stocksRepo.buy(USER_ID, {
      account_id: accountId,
      ticker,
      quantity,
      price_per_share: pricePerShare,
      fees,
      date,
    });
    stocksRepo.recalcPosition(accountId, ticker, USER_ID);
  }

  function sellStock(
    accountId: number,
    ticker: string,
    quantity: number,
    pricePerShare: number,
    fees: number,
    date: string,
  ): void {
    stocksRepo.sell(USER_ID, {
      account_id: accountId,
      ticker,
      quantity,
      price_per_share: pricePerShare,
      fees,
      date,
    });
    stocksRepo.recalcPosition(accountId, ticker, USER_ID);
  }

  // DCAM.PA — ETF Amundi Diversifié : 2 achats → PRU ≈ 10,80 € (historique ~1 an)
  buyStock(accPEA, 'DCAM.PA', 20, 10.5, 0.99, yearsAgo(1, 0, 15));
  buyStock(accPEA, 'DCAM.PA', 15, 11.2, 0.99, yearsAgo(1, 2, 10));

  // AAPL — Apple : 1 achat
  buyStock(accPEA, 'AAPL', 5, 170, 1.99, yearsAgo(1, 1, 10));

  // LVMH.PA — LVMH : achat (historique) + vente partielle récente → 1 action restante
  buyStock(accPEA, 'LVMH.PA', 2, 580, 1.99, yearsAgo(1, 0, 20));
  sellStock(accPEA, 'LVMH.PA', 1, 620, 1.99, monthDay(-2, 15));

  // Cours actuels simulés
  const stmtPrice = db.prepare(`
    INSERT OR REPLACE INTO stock_prices (ticker, price, currency, fetched_at, name)
    VALUES (?, ?, ?, datetime('now'), ?)
  `);
  stmtPrice.run('DCAM.PA', 11.85, 'EUR', 'DCAM Amundi Diversifié');
  stmtPrice.run('AAPL', 185.5, 'USD', 'Apple Inc.');
  stmtPrice.run('LVMH.PA', 610, 'EUR', 'LVMH Moët Hennessy');

  // ── Assurance Vie & PER ──────────────────────────────────────────────────────
  const insuranceRepo = createInsuranceRepo(db);

  const avFondsEuro = insuranceRepo.createSupport(USER_ID, {
    account_id: accAV,
    name: 'Fonds Euro Linxea',
    type: 'euro',
    ticker: null,
  });
  const avAmundi = insuranceRepo.createSupport(USER_ID, {
    account_id: accAV,
    name: 'Amundi MSCI World ETF',
    type: 'uc',
    ticker: 'LU1681043599.SW',
  });

  insuranceRepo.versement(USER_ID, {
    account_id: accAV,
    support_id: avFondsEuro.id,
    amount: 5000,
    fees: 0,
    date: yearsAgo(2, 0, 15),
  });
  insuranceRepo.interets(USER_ID, {
    account_id: accAV,
    support_id: avFondsEuro.id,
    amount: 125,
    date: yearsAgo(1, 0, 1),
  });
  insuranceRepo.rachat(USER_ID, {
    account_id: accAV,
    support_id: avFondsEuro.id,
    amount: 1000,
    fees: 0,
    social_fees: 14.5, // prélèvements sociaux 17,2% sur la part de gains rachetée
    date: yearsAgo(1, 8, 1),
  });

  insuranceRepo.versement(USER_ID, {
    account_id: accAV,
    support_id: avAmundi.id,
    amount: 2000,
    fees: 20, // frais d'entrée 1% sur versement UC
    date: yearsAgo(2, 2, 20),
  });
  insuranceRepo.versement(USER_ID, {
    account_id: accAV,
    support_id: avAmundi.id,
    amount: 1000,
    fees: 0,
    date: yearsAgo(2, 10, 10),
  });
  insuranceRepo.revaloriser(USER_ID, {
    account_id: accAV,
    support_id: avAmundi.id,
    amount: 150,
    date: yearsAgo(1, 0, 1),
  });

  const perFondsEuro = insuranceRepo.createSupport(USER_ID, {
    account_id: accPER,
    name: 'Fonds Euro PER',
    type: 'euro',
    ticker: null,
  });
  insuranceRepo.versement(USER_ID, {
    account_id: accPER,
    support_id: perFondsEuro.id,
    amount: 1500,
    fees: 0,
    date: yearsAgo(1, 1, 15),
  });

  // ── Prêts ────────────────────────────────────────────────────────────────────
  const loansRepo = createLoansRepo(db);
  const transfersRepo = createTransfersRepo(db);

  // Démarré il y a 18 mois → toujours « en cours » (~18/60 échéances payées)
  // quelle que soit la date du seed.
  const loanStart = monthDay(-18, 1);
  const carLoan = loansRepo.create(USER_ID, {
    name: 'Prêt voiture',
    bank_id: bankBNP,
    opening_date: loanStart,
    principal_amount: 12000,
    interest_rate: 0.03,
    duration_months: 60,
    start_date: loanStart,
    source_account_id: accBNPCourant,
    deposit_account_id: accBNPCourant,
  });

  const paidInstallments = loansRepo.getPendingInstallments(carLoan.id, dateStr(TODAY));

  for (const inst of paidInstallments) {
    const transferTxs = transfersRepo.create(USER_ID, {
      amount: inst.total_amount,
      date: inst.due_date,
      description: `Mensualité n°${inst.installment_number} — Prêt voiture`,
      from_account_id: accBNPCourant,
      to_account_id: carLoan.account_id,
      validated: true,
    });
    loansRepo.updateInstallmentTxId(inst.id, transferTxs.income.id);
  }

  // ── Planifications ───────────────────────────────────────────────────────────
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
    type: TransactionType;
    amount: number;
    description: string;
    subcategory_id: number;
    payment_method_id: number;
    notes: string | null;
    recurrence_unit: RecurrenceUnit;
    recurrence_interval: number;
    recurrence_day: number | null;
    recurrence_month: number | null;
    weekend_handling: WeekendHandling;
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
      toCents(s.amount),
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
    start_date: yearsAgo(2, 0, 1),
    end_date: null,
    active: 1,
  });
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
    start_date: yearsAgo(4, 0, 10),
    end_date: null,
    active: 1,
  });
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
    start_date: yearsAgo(4, 0, 10),
    end_date: null,
    active: 1,
  });
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
    start_date: yearsAgo(4, 0, 28),
    end_date: null,
    active: 1,
  });
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
    start_date: yearsAgo(3, 2, 15),
    end_date: null,
    active: 1,
  });
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
    start_date: yearsAgo(3, 2, 15),
    end_date: null,
    active: 1,
  });

  // Versement PER planifié — débité du compte courant vers un support d'assurance.
  // account_id = compte AV/PER cible, to_account_id = compte source débité.
  db.prepare(
    `
      INSERT INTO scheduled_transactions
          (user_id, account_id, to_account_id, type, amount, description,
           subcategory_id, payment_method_id, notes, recurrence_unit, recurrence_interval,
           recurrence_day, recurrence_month, weekend_handling, start_date, end_date, active,
           insurance_support_id, insurance_fees)
      VALUES (?, ?, ?, 'expense', ?, ?, NULL, ?, NULL, 'month', 1, ?, NULL, 'allow', ?, NULL, 1, ?, ?)
  `,
  ).run(
    USER_ID,
    accPER,
    accBNPCourant,
    toCents(150),
    'Versement PER mensuel',
    pmVirement,
    15,
    yearsAgo(1, 1, 15),
    perFondsEuro.id,
    toCents(0),
  );

  console.log('Jeu de données de développement chargé.');
  console.log(
    '  Comptes       : 10 (BNP x2, BoursoBank x2, Crédit Agricole, Revolut, PEA, AV Linxea, PER Linxea, Prêt voiture) + 1 clôturé',
  );
  console.log(
    `  Transactions  : ~${40 + paidInstallments.length * 2} (dont 8 virements liés, Bourse achats/ventes + frais séparés, 1 ventilée, ${paidInstallments.length} mensualités payées, 1 remboursement partiel Sécu)`,
  );
  console.log(
    '  Bourse (PEA)  : DCAM.PA x35 (PRU 10,80€), AAPL x5 (PRU 170$), LVMH.PA x1 (PRU 580€) — frais en tx séparées',
  );
  console.log(
    '  Assurance Vie : Fonds Euro 4 110,50€ (rachat avec prélèv. sociaux) + Amundi MSCI World 3 130€ (versement avec frais)',
  );
  console.log('  PER           : Fonds Euro PER 1 500€');
  console.log(
    `  Prêts         : 1 (Prêt voiture 12 000€ à 3%, ${paidInstallments.length}/60 mensualités payées)`,
  );
  console.log('  Remboursements: 1 lien partiel (Pharmacie 22,50€ → Sécu 15,75€ attribués)');
  console.log('  Planifications: 7 (dont 1 versement PER mensuel)');
  console.log(`  Dates ancrées sur : ${dateStr(TODAY)} (override possible via SEED_TODAY)`);
  console.log('  Identifiants  : test / test (admin inchangé)');
}

// ── Script standalone ─────────────────────────────────────────────────────────
const DB_PATH = path.join(DATA_DIR, 'cashctrl.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(
    "Base de données introuvable. Lance d'abord `npm run db:reset` ou `npm run db:reset:dev`.",
  );
  process.exit(1);
}

seedTestData(createDb());
