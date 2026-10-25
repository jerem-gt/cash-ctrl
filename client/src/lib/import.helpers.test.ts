import type { Account, Category } from '@cashctrl/types';
import { describe, expect, it } from 'vitest';

import {
  type AccountChoice,
  buildExecuteBody,
  buildRowIndex,
  type CategoryChoice,
  findAutoCategory,
  likeMatch,
  type PreviewItem,
  type PreviewOptions,
  resolveAccountInfo,
  resolveCategoryInfo,
  resolvePreview,
  resolveXhbPreview,
  safeParseDate,
} from './import.helpers';
import type { ParsedSplit } from './import-model';
import type { XhbParseResult, XhbTransaction } from './xhb-parser';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACCOUNT: Account = {
  id: 1,
  name: 'Courant',
  bank_id: 1,
  bank: 'BNP',
  account_type_id: 1,
  type: 'Courant',
  envelope_type: null,
  initial_balance: 0,
  opening_date: '2024-01-01',
  closed_at: null,
  favorite_order: null,
  balance: 0,
  balance_stocks: 0,
  balance_insurance: 0,
  balance_all: 0,
  capital_restant_du: null,
  capital_restant_du_all: null,
};

const CATEGORIES: Category[] = [
  { id: 1, name: 'Alimentation', icon: '🍴', subcategories: [{ id: 10, name: 'Supermarché' }] },
  { id: 2, name: 'Loisirs', icon: '🎮', subcategories: [{ id: 20, name: 'Cinéma' }] },
];

function makeTx(
  overrides: Partial<{
    date: string;
    amount: number;
    description: string;
    accountName: string;
    category: string;
    memo: string | null;
    cleared: boolean;
    isTransfer: boolean;
    transferTarget: string | null;
  }> = {},
) {
  return {
    date: '15/01/2024',
    amount: -50,
    description: 'Test',
    accountName: 'ACC1',
    category: '',
    memo: null,
    cleared: false,
    isTransfer: false,
    transferTarget: null,
    ...overrides,
  };
}

// ─── findAutoCategory ─────────────────────────────────────────────────────────

describe('findAutoCategory', () => {
  it(`mappe "Catégorie:Sous-catégorie" quand les deux correspondent`, () => {
    const r = findAutoCategory('Alimentation:Supermarché', CATEGORIES);
    expect(r).toEqual({ action: 'map', subcategory_id: 10 });
  });

  it('mappe par nom de sous-catégorie seul quand pas de préfixe catégorie', () => {
    const r = findAutoCategory('Cinéma', CATEGORIES);
    expect(r).toEqual({ action: 'map', subcategory_id: 20 });
  });

  it('est insensible à la casse', () => {
    const r = findAutoCategory('alimentation:supermarché', CATEGORIES);
    expect(r).toEqual({ action: 'map', subcategory_id: 10 });
  });

  it('retourne null si la catégorie parente ne correspond pas', () => {
    expect(findAutoCategory('Loisirs:Supermarché', CATEGORIES)).toBeNull();
  });

  it('retourne null si aucune correspondance', () => {
    expect(findAutoCategory('Inconnu:Introuvable', CATEGORIES)).toBeNull();
  });
});

// ─── safeParseDate ────────────────────────────────────────────────────────────

describe('safeParseDate', () => {
  it('retourne la date parsée si valide', () => {
    expect(safeParseDate('15/01/2024', 'DD/MM')).toBe('2024-01-15');
  });

  it('retourne le fallback pour une date invalide', () => {
    expect(safeParseDate('nope', 'DD/MM')).toBe('2000-01-01');
  });
});

// ─── resolveAccountInfo ───────────────────────────────────────────────────────

describe('resolveAccountInfo', () => {
  it('non résolu si choice absent', () => {
    const r = resolveAccountInfo('ACC', undefined, []);
    expect(r.resolved).toBe(false);
    expect(r.accountId).toBeNull();
  });

  it('non résolu si action skip', () => {
    const r = resolveAccountInfo('ACC', { action: 'skip' }, []);
    expect(r.resolved).toBe(false);
  });

  it('résolu avec accountId si action map', () => {
    const r = resolveAccountInfo('ACC', { action: 'map', account_id: 1 }, [ACCOUNT]);
    expect(r.resolved).toBe(true);
    expect(r.accountId).toBe(1);
    expect(r.accountName).toBe('Courant');
    expect(r.newAccountSourceName).toBeNull();
  });

  it('résolu avec sourceName si action create', () => {
    const choice: AccountChoice = {
      action: 'create',
      name: 'Nouveau',
      bank_id: 1,
      bank_name: 'BNP',
      account_type_id: 1,
      initial_balance: 0,
      opening_date: '2024-01-01',
    };
    const r = resolveAccountInfo('QIF_ACC', choice, []);
    expect(r.resolved).toBe(true);
    expect(r.accountId).toBeNull();
    expect(r.newAccountSourceName).toBe('QIF_ACC');
    expect(r.accountName).toBe('Nouveau');
    expect(r.bankName).toBe('BNP');
  });
});

// ─── resolveCategoryInfo ──────────────────────────────────────────────────────

describe('resolveCategoryInfo', () => {
  const choices = new Map<string, CategoryChoice>();

  it('retourne un info vide pour une catégorie vide', () => {
    const r = resolveCategoryInfo('', choices, CATEGORIES);
    expect(r).not.toBeNull();
    expect(r!.subcategoryId).toBeNull();
    expect(r!.categoryLabel).toBe('');
  });

  it('retourne null si catégorie absente du map', () => {
    expect(resolveCategoryInfo('Inconnue', choices, CATEGORIES)).toBeNull();
  });

  it('retourne null si action skip', () => {
    const m = new Map<string, CategoryChoice>([['Food', { action: 'skip' }]]);
    expect(resolveCategoryInfo('Food', m, CATEGORIES)).toBeNull();
  });

  it('retourne subcategoryId et label si action map', () => {
    const m = new Map<string, CategoryChoice>([
      ['Alimentation', { action: 'map', subcategory_id: 10 }],
    ]);
    const r = resolveCategoryInfo('Alimentation', m, CATEGORIES);
    expect(r).not.toBeNull();
    expect(r!.subcategoryId).toBe(10);
    expect(r!.categoryLabel).toBe('Alimentation / Supermarché');
    expect(r!.newSubcategoryKey).toBeNull();
    expect(r!.isNew).toBe(false);
  });

  it("retourne subcategoryId sans label si la sous-catégorie n'est pas trouvée", () => {
    const m = new Map<string, CategoryChoice>([['X', { action: 'map', subcategory_id: 999 }]]);
    const r = resolveCategoryInfo('X', m, CATEGORIES);
    expect(r!.subcategoryId).toBe(999);
    expect(r!.categoryLabel).toBe('');
  });

  it('retourne newSubcategoryKey avec catégorie existante si action create', () => {
    const m = new Map<string, CategoryChoice>([
      [
        'Food:New',
        {
          action: 'create',
          existing_category_id: 1,
          new_category_name: '',
          new_category_icon: '',
          subcategory_name: 'Épicerie',
        },
      ],
    ]);
    const r = resolveCategoryInfo('Food:New', m, CATEGORIES);
    expect(r!.newSubcategoryKey).toBe('Food:New');
    expect(r!.categoryLabel).toBe('Alimentation / Épicerie');
    expect(r!.subcategoryId).toBeNull();
    expect(r!.isNew).toBe(true);
  });

  it('utilise new_category_name si pas de catégorie existante', () => {
    const m = new Map<string, CategoryChoice>([
      [
        'Pets',
        {
          action: 'create',
          existing_category_id: null,
          new_category_name: 'Animaux',
          new_category_icon: '🐾',
          subcategory_name: 'Vétérinaire',
        },
      ],
    ]);
    const r = resolveCategoryInfo('Pets', m, CATEGORIES);
    expect(r!.categoryLabel).toBe('Animaux / Vétérinaire');
  });
});

// ─── resolvePreview ───────────────────────────────────────────────────────────

describe('resolvePreview', () => {
  const accChoicesMapped = new Map<string, AccountChoice>([
    ['ACC1', { action: 'map', account_id: 1 }],
  ]);
  const catChoicesMapped = new Map<string, CategoryChoice>([
    ['Alimentation', { action: 'map', subcategory_id: 10 }],
  ]);

  const baseParsed = {
    accounts: ['ACC1'],
    uniqueCategories: [],
    uniqueTransferTargets: [],
    detectedDateFormat: 'DD/MM' as const,
    transactions: [] as ReturnType<typeof makeTx>[],
  };

  it('produit une transaction mappée', () => {
    const parsed = { ...baseParsed, transactions: [makeTx({ category: 'Alimentation' })] };
    const items = resolvePreview(
      parsed,
      'DD/MM',
      accChoicesMapped,
      catChoicesMapped,
      [ACCOUNT],
      CATEGORIES,
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('transaction');
    if (items[0].kind === 'transaction') {
      expect(items[0].accountId).toBe(1);
      expect(items[0].subcategoryId).toBe(10);
      expect(items[0].type).toBe('expense');
    }
  });

  it('produit income pour un montant positif', () => {
    const parsed = { ...baseParsed, transactions: [makeTx({ amount: 1000, category: '' })] };
    const items = resolvePreview(
      parsed,
      'DD/MM',
      accChoicesMapped,
      new Map(),
      [ACCOUNT],
      CATEGORIES,
    );
    expect(items[0].kind).toBe('transaction');
    if (items[0].kind === 'transaction') expect(items[0].type).toBe('income');
  });

  it('skip si compte non mappé', () => {
    const parsed = { ...baseParsed, transactions: [makeTx()] };
    const items = resolvePreview(parsed, 'DD/MM', new Map(), new Map(), [ACCOUNT], CATEGORIES);
    expect(items[0].kind).toBe('skip');
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('unmapped_account');
  });

  it('skip si catégorie ignorée', () => {
    const parsed = { ...baseParsed, transactions: [makeTx({ category: 'Alimentation' })] };
    const skippedCat = new Map<string, CategoryChoice>([['Alimentation', { action: 'skip' }]]);
    const items = resolvePreview(
      parsed,
      'DD/MM',
      accChoicesMapped,
      skippedCat,
      [ACCOUNT],
      CATEGORIES,
    );
    expect(items[0].kind).toBe('skip');
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('skipped_category');
  });

  it('transaction sans catégorie est incluse', () => {
    const parsed = { ...baseParsed, transactions: [makeTx({ category: '' })] };
    const items = resolvePreview(
      parsed,
      'DD/MM',
      accChoicesMapped,
      new Map(),
      [ACCOUNT],
      CATEGORIES,
    );
    expect(items[0].kind).toBe('transaction');
  });

  it('skip un virement sans contrepartie et sans transferTarget', () => {
    const parsed = {
      ...baseParsed,
      transactions: [makeTx({ isTransfer: true, transferTarget: null, amount: -500 })],
    };
    const items = resolvePreview(
      parsed,
      'DD/MM',
      accChoicesMapped,
      new Map(),
      [ACCOUNT],
      CATEGORIES,
    );
    expect(items[0].kind).toBe('skip');
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('transfer_no_peer');
  });

  it("skip un virement sans contrepartie quand le compte cible n'est pas mappé", () => {
    const parsed = {
      ...baseParsed,
      transactions: [makeTx({ isTransfer: true, transferTarget: 'ACC2', amount: -500 })],
    };
    const items = resolvePreview(
      parsed,
      'DD/MM',
      accChoicesMapped,
      new Map(),
      [ACCOUNT],
      CATEGORIES,
    );
    expect(items[0].kind).toBe('skip');
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('unmapped_account');
  });

  it('produit un transfer depuis une seule transaction quand le compte cible est mappé', () => {
    const acc2: Account = { ...ACCOUNT, id: 2, name: 'Épargne' };
    const parsed = {
      ...baseParsed,
      transactions: [makeTx({ isTransfer: true, transferTarget: 'ACC2', amount: -500 })],
    };
    const choices = new Map<string, AccountChoice>([
      ['ACC1', { action: 'map', account_id: 1 }],
      ['ACC2', { action: 'map', account_id: 2 }],
    ]);
    const items = resolvePreview(parsed, 'DD/MM', choices, new Map(), [ACCOUNT, acc2], CATEGORIES);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('transfer');
    if (items[0].kind === 'transfer') {
      expect(items[0].fromAccountId).toBe(1);
      expect(items[0].toAccountId).toBe(2);
      expect(items[0].amount).toBe(500);
    }
  });

  it('produit un transfer quand la contrepartie est trouvée et les deux comptes mappés', () => {
    const acc2: Account = { ...ACCOUNT, id: 2, name: 'Épargne' };
    const tx1 = makeTx({
      accountName: 'ACC1',
      amount: -500,
      isTransfer: true,
      transferTarget: 'ACC2',
    });
    const tx2 = makeTx({
      accountName: 'ACC2',
      amount: 500,
      isTransfer: true,
      transferTarget: 'ACC1',
    });
    const parsed = { ...baseParsed, transactions: [tx1, tx2] };
    const choices = new Map<string, AccountChoice>([
      ['ACC1', { action: 'map', account_id: 1 }],
      ['ACC2', { action: 'map', account_id: 2 }],
    ]);
    const items = resolvePreview(parsed, 'DD/MM', choices, new Map(), [ACCOUNT, acc2], CATEGORIES);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('transfer');
    if (items[0].kind === 'transfer') {
      expect(items[0].fromAccountId).toBe(1);
      expect(items[0].toAccountId).toBe(2);
      expect(items[0].amount).toBe(500);
    }
  });

  it("skip un virement si un compte n'est pas mappé", () => {
    const tx1 = makeTx({
      accountName: 'ACC1',
      amount: -500,
      isTransfer: true,
      transferTarget: 'ACC2',
    });
    const tx2 = makeTx({
      accountName: 'ACC2',
      amount: 500,
      isTransfer: true,
      transferTarget: 'ACC1',
    });
    const parsed = { ...baseParsed, transactions: [tx1, tx2] };
    const items = resolvePreview(
      parsed,
      'DD/MM',
      accChoicesMapped,
      new Map(),
      [ACCOUNT],
      CATEGORIES,
    );
    expect(items[0].kind).toBe('skip');
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('unmapped_account');
  });

  it("n'inclut pas la transaction côté crédit d'un virement dans les items", () => {
    const acc2: Account = { ...ACCOUNT, id: 2, name: 'Épargne' };
    const tx1 = makeTx({
      accountName: 'ACC1',
      amount: -500,
      isTransfer: true,
      transferTarget: 'ACC2',
    });
    const tx2 = makeTx({
      accountName: 'ACC2',
      amount: 500,
      isTransfer: true,
      transferTarget: 'ACC1',
    });
    const parsed = { ...baseParsed, transactions: [tx1, tx2] };
    const choices = new Map<string, AccountChoice>([
      ['ACC1', { action: 'map', account_id: 1 }],
      ['ACC2', { action: 'map', account_id: 2 }],
    ]);
    const items = resolvePreview(parsed, 'DD/MM', choices, new Map(), [ACCOUNT, acc2], CATEGORIES);
    expect(items).toHaveLength(1);
  });

  it('génère la description du virement avec noms de comptes si même banque', () => {
    const acc2: Account = { ...ACCOUNT, id: 2, name: 'Épargne', bank: 'BNP' };
    const parsed = {
      ...baseParsed,
      transactions: [makeTx({ isTransfer: true, transferTarget: 'ACC2', amount: -500 })],
    };
    const choices = new Map<string, AccountChoice>([
      ['ACC1', { action: 'map', account_id: 1 }],
      ['ACC2', { action: 'map', account_id: 2 }],
    ]);
    const items = resolvePreview(parsed, 'DD/MM', choices, new Map(), [ACCOUNT, acc2], CATEGORIES);
    expect(items[0].kind).toBe('transfer');
    if (items[0].kind === 'transfer') expect(items[0].description).toBe('Courant → Épargne');
  });

  it('génère la description du virement avec noms de banques si banques différentes', () => {
    const acc2: Account = { ...ACCOUNT, id: 2, name: 'Épargne', bank: 'Boursorama' };
    const parsed = {
      ...baseParsed,
      transactions: [makeTx({ isTransfer: true, transferTarget: 'ACC2', amount: -500 })],
    };
    const choices = new Map<string, AccountChoice>([
      ['ACC1', { action: 'map', account_id: 1 }],
      ['ACC2', { action: 'map', account_id: 2 }],
    ]);
    const items = resolvePreview(parsed, 'DD/MM', choices, new Map(), [ACCOUNT, acc2], CATEGORIES);
    expect(items[0].kind).toBe('transfer');
    if (items[0].kind === 'transfer') expect(items[0].description).toBe('BNP → Boursorama');
  });
});

// ─── buildExecuteBody ─────────────────────────────────────────────────────────

describe('buildExecuteBody', () => {
  const txItem: PreviewItem = {
    kind: 'transaction',
    idx: 0,
    date: '2024-01-15',
    type: 'expense',
    amount: 50,
    description: 'Test',
    accountId: 1,
    newAccountSourceName: null,
    accountName: 'Courant',
    subcategoryId: 10,
    newSubcategoryKey: null,
    categoryLabel: 'Alimentation / Supermarché',
    categoryIsNew: false,
    notes: null,
    validated: false,
    paymentMethodId: null,
  };
  const transferItem: PreviewItem = {
    kind: 'transfer',
    idxPrimary: 0,
    date: '2024-01-15',
    amount: 500,
    description: 'Virement',
    fromAccountId: 1,
    fromAccountSourceName: null,
    fromAccountName: 'Courant',
    toAccountId: 2,
    toAccountSourceName: null,
    toAccountName: 'Épargne',
    notes: null,
    validated: false,
  };
  const skipItem: PreviewItem = {
    kind: 'skip',
    idx: 2,
    date: '2024-01-01',
    amount: 0,
    description: 'X',
    reason: 'unmapped_account',
  };

  it('inclut une transaction sélectionnée', () => {
    const body = buildExecuteBody([txItem], new Set([0]), new Map(), new Map(), '(no description)');
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0].account_id).toBe(1);
    expect(body.transactions[0].amount).toBe(50);
  });

  it('exclut une transaction non sélectionnée', () => {
    const body = buildExecuteBody([txItem], new Set(), new Map(), new Map(), '(no description)');
    expect(body.transactions).toHaveLength(0);
  });

  it('remplace une description vide par le libellé de repli (serveur exige min(1))', () => {
    const item: PreviewItem = { ...txItem, description: '' };
    const body = buildExecuteBody([item], new Set([0]), new Map(), new Map(), '(no description)');
    expect(body.transactions[0].description).toBe('(no description)');
  });

  it('ignore les items de type skip', () => {
    const body = buildExecuteBody(
      [skipItem],
      new Set([0]),
      new Map(),
      new Map(),
      '(no description)',
    );
    expect(body.transactions).toHaveLength(0);
    expect(body.transfers).toHaveLength(0);
  });

  it('inclut un virement sélectionné', () => {
    const body = buildExecuteBody(
      [transferItem],
      new Set([0]),
      new Map(),
      new Map(),
      '(no description)',
    );
    expect(body.transfers).toHaveLength(1);
    expect(body.transfers[0].from_account_id).toBe(1);
    expect(body.transfers[0].to_account_id).toBe(2);
    expect(body.transfers[0].amount).toBe(500);
  });

  it('collecte un nouveau compte pour une transaction liée à un compte à créer', () => {
    const item: PreviewItem = { ...txItem, accountId: null, newAccountSourceName: 'QIF_NEW' };
    const accChoices = new Map<string, AccountChoice>([
      [
        'QIF_NEW',
        {
          action: 'create',
          name: 'Nouveau',
          bank_id: 1,
          bank_name: null,
          account_type_id: 1,
          initial_balance: 0,
          opening_date: '2024-01-01',
        },
      ],
    ]);
    const body = buildExecuteBody([item], new Set([0]), accChoices, new Map(), '(no description)');
    expect(body.newAccounts).toHaveLength(1);
    expect(body.newAccounts[0].source_name).toBe('QIF_NEW');
    expect(body.newAccounts[0].name).toBe('Nouveau');
  });

  it('déduplique les nouveaux comptes référencés plusieurs fois', () => {
    const item1: PreviewItem = { ...txItem, accountId: null, newAccountSourceName: 'SAME' };
    const item2: PreviewItem = { ...txItem, idx: 1, accountId: null, newAccountSourceName: 'SAME' };
    const accChoices = new Map<string, AccountChoice>([
      [
        'SAME',
        {
          action: 'create',
          name: 'Compte',
          bank_id: null,
          bank_name: null,
          account_type_id: null,
          initial_balance: 0,
          opening_date: '2024-01-01',
        },
      ],
    ]);
    const body = buildExecuteBody(
      [item1, item2],
      new Set([0, 1]),
      accChoices,
      new Map(),
      '(no description)',
    );
    expect(body.newAccounts).toHaveLength(1);
  });

  it('collecte une nouvelle sous-catégorie', () => {
    const item: PreviewItem = { ...txItem, subcategoryId: null, newSubcategoryKey: 'Food:New' };
    const catChoices = new Map<string, CategoryChoice>([
      [
        'Food:New',
        {
          action: 'create',
          existing_category_id: 1,
          new_category_name: '',
          new_category_icon: '',
          subcategory_name: 'Épicerie',
        },
      ],
    ]);
    const body = buildExecuteBody([item], new Set([0]), new Map(), catChoices, '(no description)');
    expect(body.newSubcategories).toHaveLength(1);
    expect(body.newSubcategories[0].source_key).toBe('Food:New');
    expect(body.newSubcategories[0].subcategory_name).toBe('Épicerie');
    expect(body.newSubcategories[0].category_id).toBe(1);
  });

  it('collecte les nouveaux comptes from/to pour un virement', () => {
    const item: PreviewItem = {
      ...transferItem,
      fromAccountId: null,
      fromAccountSourceName: 'QIF_FROM',
      toAccountId: null,
      toAccountSourceName: 'QIF_TO',
    };
    const accChoices = new Map<string, AccountChoice>([
      [
        'QIF_FROM',
        {
          action: 'create',
          name: 'From',
          bank_id: null,
          bank_name: null,
          account_type_id: null,
          initial_balance: 0,
          opening_date: '2024-01-01',
        },
      ],
      [
        'QIF_TO',
        {
          action: 'create',
          name: 'To',
          bank_id: null,
          bank_name: null,
          account_type_id: null,
          initial_balance: 0,
          opening_date: '2024-01-01',
        },
      ],
    ]);
    const body = buildExecuteBody([item], new Set([0]), accChoices, new Map(), '(no description)');
    expect(body.newAccounts).toHaveLength(2);
    expect(body.transfers[0].from_account_source_name).toBe('QIF_FROM');
    expect(body.transfers[0].to_account_source_name).toBe('QIF_TO');
  });

  it('retourne des tableaux vides pour un body vide', () => {
    const body = buildExecuteBody([], new Set(), new Map(), new Map(), '(no description)');
    expect(body.transactions).toHaveLength(0);
    expect(body.transfers).toHaveLength(0);
    expect(body.newAccounts).toHaveLength(0);
    expect(body.newSubcategories).toHaveLength(0);
  });
});

// ─── buildRowIndex ────────────────────────────────────────────────────────────

describe('buildRowIndex', () => {
  const tx = (idx: number): PreviewItem => ({
    kind: 'transaction',
    idx,
    date: '2024-01-15',
    type: 'expense',
    amount: 10,
    description: 'T',
    accountId: 1,
    newAccountSourceName: null,
    accountName: 'C',
    subcategoryId: null,
    newSubcategoryKey: null,
    categoryLabel: '',
    categoryIsNew: false,
    notes: null,
    validated: false,
    paymentMethodId: null,
  });
  const tf = (idxPrimary: number): PreviewItem => ({
    kind: 'transfer',
    idxPrimary,
    date: '2024-01-15',
    amount: 100,
    description: 'V',
    fromAccountId: 1,
    fromAccountSourceName: null,
    fromAccountName: 'C',
    toAccountId: 2,
    toAccountSourceName: null,
    toAccountName: 'E',
    notes: null,
    validated: false,
  });
  const skip: PreviewItem = {
    kind: 'skip',
    idx: 99,
    date: '2024-01-01',
    amount: 0,
    description: 'X',
    reason: 'unmapped_account',
  };

  it('mappe les index body → ligne en sautant skip et non-sélectionnés', () => {
    // aperçu : [tx, transfer, skip, tx] ; non sélectionné : index 3
    const items = [tx(0), tf(0), skip, tx(3)];
    const { txRows, tfRows } = buildRowIndex(items, new Set([0, 1, 2]));
    // transactions[] = [item 0] → ligne 0 ; item 3 non sélectionné, exclu
    expect(txRows).toEqual([0]);
    // transfers[] = [item 1] → ligne 1
    expect(tfRows).toEqual([1]);
  });

  it('préserve l ordre et l alignement avec buildExecuteBody', () => {
    const items = [tf(0), tx(1), tx(2)];
    const selected = new Set([0, 1, 2]);
    const { txRows, tfRows } = buildRowIndex(items, selected);
    const body = buildExecuteBody(items, selected, new Map(), new Map(), '(no desc)');
    expect(body.transactions).toHaveLength(txRows.length);
    expect(body.transfers).toHaveLength(tfRows.length);
    // transactions[0] correspond à la ligne txRows[0]
    expect(txRows).toEqual([1, 2]);
    expect(tfRows).toEqual([0]);
  });
});

// ─── likeMatch ────────────────────────────────────────────────────────────────

describe('likeMatch', () => {
  it('match exact (sans %)', () => {
    expect(likeMatch('courses leclerc', 'courses leclerc')).toBe(true);
  });

  it('% en préfixe et suffixe', () => {
    expect(likeMatch('Courses Leclerc', '%leclerc%')).toBe(true);
  });

  it('insensible à la casse', () => {
    expect(likeMatch('LECLERC DRIVE', '%leclerc%')).toBe(true);
  });

  it('retourne false si le texte ne contient pas le segment', () => {
    expect(likeMatch('LOYER JANVIER', '%leclerc%')).toBe(false);
  });

  it('% uniquement en suffixe (ancrage préfixe)', () => {
    expect(likeMatch('courses leclerc extra', 'courses%')).toBe(true);
    expect(likeMatch('paiement courses', 'courses%')).toBe(false);
  });

  it('pattern sans joker doit correspondre exactement', () => {
    expect(likeMatch('leclerc', 'leclerc')).toBe(true);
    expect(likeMatch('leclerc drive', 'leclerc')).toBe(false);
  });
});

// ─── resolvePreview avec descriptionRuleMatcher ───────────────────────────────

describe('resolvePreview — descriptionRuleMatcher', () => {
  const account: Account = {
    id: 1,
    name: 'Courant',
    bank_id: 1,
    bank: 'BNP',
    account_type_id: 1,
    type: 'Courant',
    envelope_type: null,
    initial_balance: 0,
    opening_date: '2024-01-01',
    favorite_order: null,
    closed_at: null,
    balance: 0,
    balance_stocks: 0,
    balance_insurance: 0,
    balance_all: 0,
    capital_restant_du: null,
    capital_restant_du_all: null,
  };

  const categories: Category[] = [
    {
      id: 1,
      name: 'Alimentation',
      icon: '🍴',
      subcategories: [{ id: 10, name: 'Supermarché' }],
    },
  ];

  function makeParsed(description: string, category = '') {
    return {
      transactions: [
        {
          date: '15/01/2024',
          amount: -50,
          description,
          accountName: 'ACC1',
          category,
          memo: null,
          cleared: false,
          isTransfer: false,
          transferTarget: null,
        },
      ],
      accounts: ['ACC1'],
      uniqueCategories: category ? [category] : [],
      uniqueTransferTargets: [],
      detectedDateFormat: 'DD/MM' as const,
    };
  }

  const accountChoices = new Map<string, AccountChoice>([
    ['ACC1', { action: 'map', account_id: 1 }],
  ]);

  it('utilise le matcher pour assigner la sous-catégorie', () => {
    const matcher = () => 10;
    const items = resolvePreview(
      makeParsed('Courses Leclerc'),
      'DD/MM',
      accountChoices,
      new Map(),
      [account],
      categories,
      { categoryMode: 'rules', descriptionRuleMatcher: matcher },
    );
    expect(items[0].kind).toBe('transaction');
    if (items[0].kind === 'transaction') {
      expect(items[0].subcategoryId).toBe(10);
    }
  });

  it('retourne null pour subcategoryId en mode none', () => {
    const items = resolvePreview(
      makeParsed('Courses Leclerc', 'Alimentation:Supermarché'),
      'DD/MM',
      accountChoices,
      new Map(),
      [account],
      categories,
      { categoryMode: 'none' },
    );
    expect(items[0].kind).toBe('transaction');
    if (items[0].kind === 'transaction') {
      expect(items[0].subcategoryId).toBeNull();
    }
  });

  it('utilise les categoryChoices QIF quand aucun matcher fourni', () => {
    const catChoices = new Map<string, CategoryChoice>([
      ['Alimentation:Supermarché', { action: 'map', subcategory_id: 10 }],
    ]);
    const items = resolvePreview(
      makeParsed('Courses', 'Alimentation:Supermarché'),
      'DD/MM',
      accountChoices,
      catChoices,
      [account],
      categories,
    );
    expect(items[0].kind).toBe('transaction');
    if (items[0].kind === 'transaction') {
      expect(items[0].subcategoryId).toBe(10);
    }
  });
});

// ─── Ventilations (QIF + XHB) ─────────────────────────────────────────────────

describe('ventilations', () => {
  const accChoices = new Map<string, AccountChoice>([['ACC1', { action: 'map', account_id: 1 }]]);
  const catChoices = new Map<string, CategoryChoice>([
    ['Alim', { action: 'map', subcategory_id: 10 }],
    [
      'Loisirs:Nouveau',
      {
        action: 'create',
        existing_category_id: 2,
        new_category_name: '',
        new_category_icon: '',
        subcategory_name: 'Nouveau',
      },
    ],
  ]);

  const qifLedger = (tx: ReturnType<typeof makeTx> & { splits?: ParsedSplit[] }) => ({
    accounts: ['ACC1'],
    uniqueCategories: [],
    uniqueTransferTargets: [],
    detectedDateFormat: 'DD/MM' as const,
    transactions: [tx],
  });

  const xhbParsed = (tx: Partial<XhbTransaction>): XhbParseResult => ({
    accounts: ['ACC1'],
    accountDetails: new Map(),
    transfers: [],
    uniqueCategories: [],
    uniquePaymodes: [],
    transactions: [
      {
        accountName: 'ACC1',
        date: '2024-01-15',
        amount: -100,
        description: 'Courses',
        categoryString: '',
        paymode: 0,
        notes: null,
        validated: true,
        ...tx,
      },
    ],
  });

  const good: ParsedSplit[] = [
    { category: 'Alim', amount: -60, memo: 'Viande' },
    { category: 'Loisirs:Nouveau', amount: -40, memo: null },
  ];

  const runQif = (
    splits: ParsedSplit[],
    choices = catChoices,
    options?: PreviewOptions,
    amount = -100,
  ) =>
    resolvePreview(
      qifLedger({ ...makeTx({ amount, memo: 'Note' }), splits }),
      'DD/MM',
      accChoices,
      choices,
      [ACCOUNT],
      CATEGORIES,
      options,
    );
  const runXhb = (splits: ParsedSplit[], choices = catChoices, amount = -100) =>
    resolveXhbPreview(
      xhbParsed({ splits, amount, notes: 'Note' }),
      accChoices,
      choices,
      new Map(),
      [ACCOUNT],
      CATEGORIES,
    );

  const reasonOf = (item: PreviewItem) => (item.kind === 'skip' ? item.reason : null);

  it.each([
    ['QIF', runQif],
    ['XHB', runXhb],
  ])('%s : produit un item ventilé avec libellé joint et mémos dans les notes', (_n, run) => {
    const [item] = run(good);
    expect(item.kind).toBe('transaction');
    if (item.kind !== 'transaction') return;
    expect(item.subcategoryId).toBeNull();
    expect(item.newSubcategoryKey).toBeNull();
    expect(item.categoryLabel).toBe('Alimentation / Supermarché + Loisirs / Nouveau');
    expect(item.categoryIsNew).toBe(true);
    expect(item.notes).toBe('Note · Viande');
    expect(item.amount).toBe(100);
    expect(item.type).toBe('expense');
    expect(item.splits).toEqual([
      { subcategoryId: 10, newSubcategoryKey: null, amount: 60 },
      { subcategoryId: null, newSubcategoryKey: 'Loisirs:Nouveau', amount: 40 },
    ]);
  });

  it.each([
    ['QIF', runQif],
    ['XHB', runXhb],
  ])(
    '%s : invalid_split pour somme fausse, signes mélangés, catégorie vide, [Compte]',
    (_n, run) => {
      const bad = [
        [
          { category: 'Alim', amount: -60, memo: null },
          { category: 'Alim', amount: -30, memo: null },
        ],
        [
          { category: 'Alim', amount: -150, memo: null },
          { category: 'Alim', amount: 50, memo: null },
        ],
        [
          { category: '', amount: -60, memo: null },
          { category: 'Alim', amount: -40, memo: null },
        ],
        [
          { category: '[Epargne]', amount: -60, memo: null },
          { category: 'Alim', amount: -40, memo: null },
        ],
      ];
      for (const splits of bad) expect(reasonOf(run(splits)[0])).toBe('invalid_split');
    },
  );

  it.each([
    ['QIF', runQif],
    ['XHB', runXhb],
  ])('%s : skipped_category si une ligne est ignorée', (_n, run) => {
    const choices = new Map(catChoices).set('Alim', { action: 'skip' });
    expect(reasonOf(run(good, choices)[0])).toBe('skipped_category');
  });

  it('QIF mode rules : la ventilation se résout par ses lignes, une règle ne la remplace pas', () => {
    const [item] = runQif(good, catChoices, {
      categoryMode: 'rules',
      descriptionRuleMatcher: () => 20,
    });
    expect(item.kind === 'transaction' && item.splits).toEqual([
      { subcategoryId: 10, newSubcategoryKey: null, amount: 60 },
      { subcategoryId: null, newSubcategoryKey: 'Loisirs:Nouveau', amount: 40 },
    ]);
    expect(item.kind === 'transaction' && item.subcategoryId).toBeNull();
  });

  it('QIF mode none : transaction simple sans catégorie ni splits, mémos dans les notes', () => {
    const [item] = runQif(good, new Map(), { categoryMode: 'none' });
    expect(item.kind).toBe('transaction');
    if (item.kind !== 'transaction') return;
    expect(item.subcategoryId).toBeNull();
    expect(item.newSubcategoryKey).toBeNull();
    expect(item.categoryLabel).toBe('');
    expect(item.categoryIsNew).toBe(false);
    expect(item.splits).toBeUndefined();
    expect(item.notes).toBe('Note · Viande');
    expect(item.amount).toBe(100);
  });

  it('QIF mode none : pas de contrôle invalid_split', () => {
    const bad = [{ category: '', amount: -10, memo: null }];
    const [item] = runQif(bad, new Map(), { categoryMode: 'none' });
    expect(item.kind).toBe('transaction');
  });

  it.each([
    ['QIF', (s: ParsedSplit[]) => runQif(s, catChoices, undefined, 0)],
    ['XHB', (s: ParsedSplit[]) => runXhb(s, catChoices, 0)],
  ])('%s : invalid_split si le total vaut 0', (_n, run) => {
    const zero = [
      { category: 'Alim', amount: 0, memo: null },
      { category: 'Alim', amount: 0, memo: null },
    ];
    expect(reasonOf(run(zero)[0])).toBe('invalid_split');
  });

  it("l'ExecuteBody contient les splits et la nouvelle sous-catégorie", () => {
    const items = runQif(good);
    const body = buildExecuteBody(items, new Set([0]), accChoices, catChoices, '(none)');
    expect(body.transactions[0].subcategory_id).toBeNull();
    expect(body.transactions[0].splits).toEqual([
      { subcategory_id: 10, new_subcategory_key: null, amount: 60 },
      { subcategory_id: null, new_subcategory_key: 'Loisirs:Nouveau', amount: 40 },
    ]);
    expect(body.newSubcategories.map((s) => s.source_key)).toEqual(['Loisirs:Nouveau']);
  });
});
