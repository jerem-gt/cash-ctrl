import { describe, expect, it } from 'vitest';

import type { Account, Category } from '@/types';

import {
  type AccountChoice,
  buildExecuteBody,
  type CategoryChoice,
  findAutoCategory,
  type PreviewItem,
  resolveAccountInfo,
  resolveCategoryInfo,
  resolvePreview,
  safeParseDate,
} from './import.helpers';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACCOUNT: Account = {
  id: 1,
  name: 'Courant',
  bank_id: 1,
  bank: 'BNP',
  account_type_id: 1,
  type: 'Courant',
  is_investment: 0,
  is_loan: 0,
  initial_balance: 0,
  opening_date: '2024-01-01',
  closed_at: null,
  balance: 0,
  balance_stocks: 0,
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
    qifAccountName: string;
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
    qifAccountName: 'ACC1',
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
  it('mappe "Catégorie:Sous-catégorie" quand les deux correspondent', () => {
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
    expect(r.newAccountQifName).toBeNull();
  });

  it('résolu avec qifName si action create', () => {
    const choice: AccountChoice = {
      action: 'create',
      name: 'Nouveau',
      bank_id: 1,
      account_type_id: 1,
      initial_balance: 0,
      opening_date: '2024-01-01',
    };
    const r = resolveAccountInfo('QIF_ACC', choice, []);
    expect(r.resolved).toBe(true);
    expect(r.accountId).toBeNull();
    expect(r.newAccountQifName).toBe('QIF_ACC');
    expect(r.accountName).toBe('Nouveau (nouveau)');
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
    expect(r!.categoryLabel).toBe('Alimentation / Épicerie (nouveau)');
    expect(r!.subcategoryId).toBeNull();
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
    expect(r!.categoryLabel).toBe('Animaux / Vétérinaire (nouveau)');
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
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('Compte non mappé');
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
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('Catégorie ignorée');
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
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('Virement sans contrepartie');
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
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('Compte non mappé');
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
      qifAccountName: 'ACC1',
      amount: -500,
      isTransfer: true,
      transferTarget: 'ACC2',
    });
    const tx2 = makeTx({
      qifAccountName: 'ACC2',
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
      qifAccountName: 'ACC1',
      amount: -500,
      isTransfer: true,
      transferTarget: 'ACC2',
    });
    const tx2 = makeTx({
      qifAccountName: 'ACC2',
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
    if (items[0].kind === 'skip') expect(items[0].reason).toBe('Compte non mappé');
  });

  it("n'inclut pas la transaction côté crédit d'un virement dans les items", () => {
    const acc2: Account = { ...ACCOUNT, id: 2, name: 'Épargne' };
    const tx1 = makeTx({
      qifAccountName: 'ACC1',
      amount: -500,
      isTransfer: true,
      transferTarget: 'ACC2',
    });
    const tx2 = makeTx({
      qifAccountName: 'ACC2',
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
    newAccountQifName: null,
    accountName: 'Courant',
    subcategoryId: 10,
    newSubcategoryKey: null,
    categoryLabel: 'Alimentation / Supermarché',
    notes: null,
    validated: false,
  };
  const transferItem: PreviewItem = {
    kind: 'transfer',
    idxPrimary: 0,
    date: '2024-01-15',
    amount: 500,
    description: 'Virement',
    fromAccountId: 1,
    fromAccountQifName: null,
    fromAccountName: 'Courant',
    toAccountId: 2,
    toAccountQifName: null,
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
    reason: 'test',
  };

  it('inclut une transaction sélectionnée', () => {
    const body = buildExecuteBody([txItem], new Set([0]), new Map(), new Map());
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0].account_id).toBe(1);
    expect(body.transactions[0].amount).toBe(50);
  });

  it('exclut une transaction non sélectionnée', () => {
    const body = buildExecuteBody([txItem], new Set(), new Map(), new Map());
    expect(body.transactions).toHaveLength(0);
  });

  it('ignore les items de type skip', () => {
    const body = buildExecuteBody([skipItem], new Set([0]), new Map(), new Map());
    expect(body.transactions).toHaveLength(0);
    expect(body.transfers).toHaveLength(0);
  });

  it('inclut un virement sélectionné', () => {
    const body = buildExecuteBody([transferItem], new Set([0]), new Map(), new Map());
    expect(body.transfers).toHaveLength(1);
    expect(body.transfers[0].from_account_id).toBe(1);
    expect(body.transfers[0].to_account_id).toBe(2);
    expect(body.transfers[0].amount).toBe(500);
  });

  it('collecte un nouveau compte pour une transaction liée à un compte à créer', () => {
    const item: PreviewItem = { ...txItem, accountId: null, newAccountQifName: 'QIF_NEW' };
    const accChoices = new Map<string, AccountChoice>([
      [
        'QIF_NEW',
        {
          action: 'create',
          name: 'Nouveau',
          bank_id: 1,
          account_type_id: 1,
          initial_balance: 0,
          opening_date: '2024-01-01',
        },
      ],
    ]);
    const body = buildExecuteBody([item], new Set([0]), accChoices, new Map());
    expect(body.newAccounts).toHaveLength(1);
    expect(body.newAccounts[0].qif_name).toBe('QIF_NEW');
    expect(body.newAccounts[0].name).toBe('Nouveau');
  });

  it('déduplique les nouveaux comptes référencés plusieurs fois', () => {
    const item1: PreviewItem = { ...txItem, accountId: null, newAccountQifName: 'SAME' };
    const item2: PreviewItem = { ...txItem, idx: 1, accountId: null, newAccountQifName: 'SAME' };
    const accChoices = new Map<string, AccountChoice>([
      [
        'SAME',
        {
          action: 'create',
          name: 'Compte',
          bank_id: null,
          account_type_id: null,
          initial_balance: 0,
          opening_date: '2024-01-01',
        },
      ],
    ]);
    const body = buildExecuteBody([item1, item2], new Set([0, 1]), accChoices, new Map());
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
    const body = buildExecuteBody([item], new Set([0]), new Map(), catChoices);
    expect(body.newSubcategories).toHaveLength(1);
    expect(body.newSubcategories[0].qif_key).toBe('Food:New');
    expect(body.newSubcategories[0].subcategory_name).toBe('Épicerie');
    expect(body.newSubcategories[0].category_id).toBe(1);
  });

  it('collecte les nouveaux comptes from/to pour un virement', () => {
    const item: PreviewItem = {
      ...transferItem,
      fromAccountId: null,
      fromAccountQifName: 'QIF_FROM',
      toAccountId: null,
      toAccountQifName: 'QIF_TO',
    };
    const accChoices = new Map<string, AccountChoice>([
      [
        'QIF_FROM',
        {
          action: 'create',
          name: 'From',
          bank_id: null,
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
          account_type_id: null,
          initial_balance: 0,
          opening_date: '2024-01-01',
        },
      ],
    ]);
    const body = buildExecuteBody([item], new Set([0]), accChoices, new Map());
    expect(body.newAccounts).toHaveLength(2);
    expect(body.transfers[0].from_account_qif_name).toBe('QIF_FROM');
    expect(body.transfers[0].to_account_qif_name).toBe('QIF_TO');
  });

  it('retourne des tableaux vides pour un body vide', () => {
    const body = buildExecuteBody([], new Set(), new Map(), new Map());
    expect(body.transactions).toHaveLength(0);
    expect(body.transfers).toHaveLength(0);
    expect(body.newAccounts).toHaveLength(0);
    expect(body.newSubcategories).toHaveLength(0);
  });
});
