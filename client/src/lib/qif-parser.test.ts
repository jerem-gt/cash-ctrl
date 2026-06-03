import { describe, expect, it } from 'vitest';

import { findTransferPeer, parseQif, parseQifDate } from './qif-parser';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SIMPLE_QIF = `
!Type:Bank
D15/01/2024
T-150.00
PGrocery Store
LFood:Groceries
MNote
CX
^
D20/01/2024
T2000.00
PSalaire
LIncome:Salary
^
`.trim();

const MULTI_ACCOUNT_QIF = `
!Account
NChecking
TBank
^
!Type:Bank
D15/01/2024
T-500.00
PVirement
L[Savings]
^
D10/01/2024
T-150.00
PRestaurant
LFood:Dining
^
!Account
NSavings
TSavings
^
!Type:Bank
D15/01/2024
T500.00
PVirement
L[Checking]
^
`.trim();

// ─── parseQif ─────────────────────────────────────────────────────────────────

describe('parseQif', () => {
  describe('fichier simple sans section !Account', () => {
    it('parse le nombre de transactions', () => {
      const result = parseQif(SIMPLE_QIF);
      expect(result.transactions).toHaveLength(2);
    });

    it('expose un compte vide pour les transactions sans section', () => {
      const result = parseQif(SIMPLE_QIF);
      expect(result.accounts).toEqual(['']);
      expect(result.transactions[0].qifAccountName).toBe('');
    });

    it('parse le montant négatif en dépense', () => {
      const result = parseQif(SIMPLE_QIF);
      expect(result.transactions[0].amount).toBe(-150);
    });

    it('parse la description', () => {
      const result = parseQif(SIMPLE_QIF);
      expect(result.transactions[0].description).toBe('Grocery Store');
    });

    it('parse la catégorie', () => {
      const result = parseQif(SIMPLE_QIF);
      expect(result.transactions[0].category).toBe('Food:Groceries');
    });

    it('parse le mémo', () => {
      const result = parseQif(SIMPLE_QIF);
      expect(result.transactions[0].memo).toBe('Note');
    });

    it('parse le statut validé (C=X)', () => {
      const result = parseQif(SIMPLE_QIF);
      expect(result.transactions[0].cleared).toBe(true);
      expect(result.transactions[1].cleared).toBe(false);
    });

    it('extrait les catégories uniques sans doublons', () => {
      const result = parseQif(SIMPLE_QIF);
      expect(result.uniqueCategories).toEqual(['Food:Groceries', 'Income:Salary']);
    });
  });

  describe('fichier multi-comptes', () => {
    it('parse les noms de comptes depuis les sections !Account', () => {
      const result = parseQif(MULTI_ACCOUNT_QIF);
      expect(result.accounts).toEqual(['Checking', 'Savings']);
    });

    it('associe chaque transaction à son compte', () => {
      const result = parseQif(MULTI_ACCOUNT_QIF);
      const checking = result.transactions.filter((t) => t.qifAccountName === 'Checking');
      const savings = result.transactions.filter((t) => t.qifAccountName === 'Savings');
      expect(checking).toHaveLength(2);
      expect(savings).toHaveLength(1);
    });

    it('détecte les virements via la syntaxe [NomCompte]', () => {
      const result = parseQif(MULTI_ACCOUNT_QIF);
      const transfers = result.transactions.filter((t) => t.isTransfer);
      expect(transfers).toHaveLength(2);
    });

    it('extrait le compte cible du virement', () => {
      const result = parseQif(MULTI_ACCOUNT_QIF);
      const debit = result.transactions.find((t) => t.isTransfer && t.amount < 0);
      expect(debit?.transferTarget).toBe('Savings');
    });

    it('expose les comptes de virement uniques', () => {
      const result = parseQif(MULTI_ACCOUNT_QIF);
      expect(result.uniqueTransferTargets).toEqual(expect.arrayContaining(['Savings', 'Checking']));
    });

    it("n'inclut pas les virements dans uniqueCategories", () => {
      const result = parseQif(MULTI_ACCOUNT_QIF);
      expect(result.uniqueCategories).toEqual(['Food:Dining']);
    });
  });

  describe('détection du format de date', () => {
    it('détecte DD/MM quand le jour > 12', () => {
      const qif = `!Type:Bank\nD25/01/2024\nT-10.00\nP Test\n^`;
      expect(parseQif(qif).detectedDateFormat).toBe('DD/MM');
    });

    it('détecte MM/DD quand le mois serait invalide en premier', () => {
      const qif = `!Type:Bank\nD01/25/2024\nT-10.00\nP Test\n^`;
      expect(parseQif(qif).detectedDateFormat).toBe('MM/DD');
    });

    it(`retourne "ambiguous" quand les deux valeurs sont ≤12`, () => {
      const qif = `!Type:Bank\nD01/05/2024\nT-10.00\nP Test\n^`;
      expect(parseQif(qif).detectedDateFormat).toBe('ambiguous');
    });
  });

  describe('cas limites', () => {
    it('retourne un résultat vide pour un fichier vide', () => {
      const result = parseQif('');
      expect(result.transactions).toHaveLength(0);
      expect(result.accounts).toHaveLength(0);
    });

    it('ignore les transactions sans date ou sans montant', () => {
      const qif = `!Type:Bank\nPDescription seulement\n^\nD15/01/2024\nT-10.00\nP Valide\n^`;
      const result = parseQif(qif);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Valide');
    });

    it('parse les montants avec virgule comme séparateur de milliers', () => {
      const qif = `!Type:Bank\nD01/01/2024\nT-1,500.00\nP Test\n^`;
      const result = parseQif(qif);
      expect(result.transactions[0].amount).toBe(-1500);
    });

    it('parse les montants à plusieurs séparateurs de milliers', () => {
      const qif = `!Type:Bank\nD01/01/2024\nT1,234,567.89\nP Test\n^`;
      const result = parseQif(qif);
      expect(result.transactions[0].amount).toBe(1234567.89);
    });

    it('ignore les lignes !Option et autres directives', () => {
      const qif = `!Option:AutoSwitch\n!Type:Bank\nD01/01/2024\nT-10.00\nP Test\n^`;
      const result = parseQif(qif);
      expect(result.transactions).toHaveLength(1);
    });

    it(`retourne null pour un mémo "(NULL)" (export HomeBank)`, () => {
      const qif = `!Type:Bank\nD01/01/2024\nT-10.00\nPTest\nM(NULL)\n^`;
      const result = parseQif(qif);
      expect(result.transactions[0].memo).toBeNull();
    });
  });
});

// ─── parseQifDate ─────────────────────────────────────────────────────────────

describe('parseQifDate', () => {
  it('retourne la date ISO telle quelle', () => {
    expect(parseQifDate('2024-01-15', 'DD/MM')).toBe('2024-01-15');
  });

  it('convertit DD/MM/YYYY correctement', () => {
    expect(parseQifDate('15/01/2024', 'DD/MM')).toBe('2024-01-15');
  });

  it('convertit MM/DD/YYYY correctement', () => {
    expect(parseQifDate('01/15/2024', 'MM/DD')).toBe('2024-01-15');
  });

  it('accepte le tiret comme séparateur', () => {
    expect(parseQifDate('15-01-2024', 'DD/MM')).toBe('2024-01-15');
  });

  it('convertit une année 2 chiffres < 30 vers 2000s', () => {
    expect(parseQifDate('15/01/24', 'DD/MM')).toBe('2024-01-15');
  });

  it('convertit une année 2 chiffres ≥ 30 vers 1900s', () => {
    expect(parseQifDate('15/01/95', 'DD/MM')).toBe('1995-01-15');
  });

  it('lève une erreur pour une date malformée', () => {
    expect(() => parseQifDate('invalide', 'DD/MM')).toThrow();
  });
});

// ─── findTransferPeer ─────────────────────────────────────────────────────────

describe('findTransferPeer', () => {
  const makeTx = (
    qifAccountName: string,
    amount: number,
    transferTarget: string | null,
    date = '15/01/2024',
  ) => ({
    qifAccountName,
    date,
    amount,
    description: '',
    category: transferTarget ? `[${transferTarget}]` : '',
    memo: null,
    cleared: false,
    isTransfer: transferTarget !== null,
    transferTarget,
  });

  it('trouve le virement miroir', () => {
    const txs = [makeTx('Checking', -500, 'Savings'), makeTx('Savings', 500, 'Checking')];
    expect(findTransferPeer(txs, 0, new Set())).toBe(1);
  });

  it('retourne -1 quand aucun miroir', () => {
    const txs = [makeTx('Checking', -500, 'Savings')];
    expect(findTransferPeer(txs, 0, new Set())).toBe(-1);
  });

  it('ignore les indices déjà traités', () => {
    const txs = [makeTx('Checking', -500, 'Savings'), makeTx('Savings', 500, 'Checking')];
    expect(findTransferPeer(txs, 0, new Set([1]))).toBe(-1);
  });

  it('retourne -1 si les dates ne correspondent pas', () => {
    const txs = [
      makeTx('Checking', -500, 'Savings', '15/01/2024'),
      makeTx('Savings', 500, 'Checking', '16/01/2024'),
    ];
    expect(findTransferPeer(txs, 0, new Set())).toBe(-1);
  });

  it('retourne -1 si les montants ne se compensent pas', () => {
    const txs = [makeTx('Checking', -500, 'Savings'), makeTx('Savings', 400, 'Checking')];
    expect(findTransferPeer(txs, 0, new Set())).toBe(-1);
  });

  it('retourne -1 pour une transaction non-virement', () => {
    const txs = [
      { ...makeTx('Checking', -150, null), isTransfer: false, transferTarget: null },
      makeTx('Savings', 150, 'Checking'),
    ];
    expect(findTransferPeer(txs, 0, new Set())).toBe(-1);
  });
});
