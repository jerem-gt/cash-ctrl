import '@/i18n';

import type { Category, ScheduledTransaction, Transaction } from '@cashctrl/types';
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';

import { type TxCoreState } from '@/features/transactions/components/TxCoreFields';
import { type SplitInput } from '@/features/transactions/components/TxSplitEditor';

import {
  buildSplitPayload,
  emptyCore,
  findCategoryId,
  getModalTitle,
  getSchedulingOptions,
  getSubmitLabel,
  getTransferAccounts,
  initCore,
  initSplits,
  isEditFormIncomplete,
  isTxFormIncomplete,
  validateSplits,
} from './txForm';

const t = i18n.getFixedT('fr', 'transactions');
const tc = i18n.getFixedT('fr', 'common');

const CATS: Pick<Category, 'id' | 'name' | 'subcategories'>[] = [
  {
    id: 1,
    name: 'Alimentation',
    subcategories: [
      { id: 10, name: 'Supermarché', category_id: 1 },
      { id: 11, name: 'Restaurant', category_id: 1 },
    ],
  },
  {
    id: 2,
    name: 'Transport',
    subcategories: [{ id: 20, name: 'Essence', category_id: 2 }],
  },
];

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    account_id: 1,
    type: 'expense',
    amount: 50,
    description: 'Test',
    category_id: 1,
    subcategory_id: 10,
    category: 'Alimentation',
    subcategory: 'Supermarché',
    date: '2026-04-20',
    transfer_peer_id: null,
    transfer_peer_account_id: null,
    scheduled_id: null,
    validated: 0,
    payment_method_id: 1,
    payment_method: 'CB',
    notes: null,
    reimbursement_status: null,
    loan_principal: null,
    ...overrides,
  };
}

describe('emptyCore', () => {
  it('renvoie un core vide sans fixedAccountId', () => {
    const c = emptyCore();
    expect(c.type).toBe('expense');
    expect(c.account_id).toBe('');
    expect(c.amount).toBe('');
  });

  it('préfixe account_id avec fixedAccountId', () => {
    expect(emptyCore(7).account_id).toBe('7');
  });
});

describe('getTransferAccounts', () => {
  it('mappe expense → from=this account, to=peer', () => {
    const tx = makeTx({ type: 'expense', account_id: 1, transfer_peer_account_id: 2 });
    expect(getTransferAccounts(tx)).toEqual({ from: '1', to: '2' });
  });

  it('mappe income → from=peer, to=this account', () => {
    const tx = makeTx({ type: 'income', account_id: 1, transfer_peer_account_id: 2 });
    expect(getTransferAccounts(tx)).toEqual({ from: '2', to: '1' });
  });

  it('fallback sur this account si peer manquant', () => {
    const tx = makeTx({ type: 'expense', account_id: 1, transfer_peer_account_id: null });
    expect(getTransferAccounts(tx)).toEqual({ from: '1', to: '' });
  });
});

describe('initCore', () => {
  it('renvoie emptyCore si pas de tx ni duplicate', () => {
    expect(initCore(null, undefined, undefined)).toEqual(emptyCore());
  });

  it('initialise depuis une tx en édition', () => {
    const tx = makeTx({ amount: 42.5, subcategory_id: 10, category_id: 1 });
    const c = initCore(tx, undefined, undefined);
    expect(c.amount).toBe('42.50');
    expect(c.subcategory_id).toBe('10');
    expect(c.category_id).toBe('1');
  });

  it("force le type 'expense' lors d'une duplication de transfert", () => {
    const tx = makeTx({ type: 'income', transfer_peer_id: 2, transfer_peer_account_id: 3 });
    const c = initCore(null, tx, undefined);
    expect(c.type).toBe('expense');
  });

  it('utilise fixedAccountId pour une création non-transfert', () => {
    const tx = makeTx({ account_id: 1 });
    const c = initCore(null, tx, 99);
    expect(c.account_id).toBe('99');
  });

  it('respecte les account_id du transfert quand on édite (pas de fixedAccountId override)', () => {
    const tx = makeTx({ transfer_peer_id: 2, transfer_peer_account_id: 5, account_id: 3 });
    const c = initCore(tx, undefined, 99);
    expect(c.account_id).toBe('3');
    expect(c.to_account_id).toBe('5');
  });

  it('mappe subcategory_id null en chaîne vide', () => {
    const tx = makeTx({ subcategory_id: null, category_id: null });
    const c = initCore(tx, undefined, undefined);
    expect(c.subcategory_id).toBe('');
    expect(c.category_id).toBe('');
  });
});

describe('findCategoryId', () => {
  it('retrouve la catégorie parente depuis une sous-catégorie', () => {
    expect(findCategoryId(CATS, 11)).toBe('1');
    expect(findCategoryId(CATS, 20)).toBe('2');
  });

  it('renvoie chaîne vide si introuvable', () => {
    expect(findCategoryId(CATS, 999)).toBe('');
  });
});

describe('initSplits', () => {
  it('renvoie [] sans source ni splits', () => {
    expect(initSplits(null, CATS)).toEqual([]);
    expect(initSplits(makeTx(), CATS)).toEqual([]);
  });

  it('mappe les splits avec leur catégorie parente', () => {
    const tx = makeTx({
      splits: [
        { id: 1, transaction_id: 1, subcategory_id: 11, amount: 30 },
        { id: 2, transaction_id: 1, subcategory_id: 20, amount: 20 },
      ],
    });
    const result = initSplits(tx, CATS);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      _key: '11',
      category_id: '1',
      subcategory_id: '11',
      amount: '30.00',
    });
    expect(result[1].category_id).toBe('2');
  });
});

describe('validateSplits', () => {
  const baseRow: SplitInput = {
    _key: 'a',
    category_id: '1',
    subcategory_id: '10',
    amount: '50',
  };

  it('renvoie une erreur si la liste est vide', () => {
    expect(validateSplits([], 50, t)).toContain('Ajoutez');
  });

  it('renvoie une erreur si une ligne manque de sous-catégorie', () => {
    const err = validateSplits([{ ...baseRow, subcategory_id: '' }], 50, t);
    expect(err).toBeTruthy();
  });

  it('renvoie une erreur si une ligne a un montant <= 0', () => {
    const err = validateSplits([{ ...baseRow, amount: '0' }], 50, t);
    expect(err).toBeTruthy();
  });

  it('renvoie une erreur si la somme ne correspond pas au total', () => {
    const err = validateSplits([{ ...baseRow, amount: '40' }], 50, t);
    expect(err).toContain('40');
    expect(err).toContain('50');
  });

  it('tolère une différence ≤ 0,01 (arrondi)', () => {
    expect(validateSplits([{ ...baseRow, amount: '50.005' }], 50, t)).toBeNull();
  });

  it('renvoie null pour une ventilation valide', () => {
    expect(
      validateSplits(
        [
          { ...baseRow, amount: '30' },
          { ...baseRow, _key: 'b', subcategory_id: '11', amount: '20' },
        ],
        50,
        t,
      ),
    ).toBeNull();
  });
});

function core(overrides: Partial<TxCoreState> = {}): TxCoreState {
  return {
    ...emptyCore(),
    amount: '50',
    description: 'X',
    account_id: '1',
    subcategory_id: '10',
    payment_method_id: '1',
    ...overrides,
  };
}

describe('isEditFormIncomplete', () => {
  it('true si amount manquant', () => {
    expect(isEditFormIncomplete(core({ amount: '' }), false, false)).toBe(true);
  });

  it('true si description manquante', () => {
    expect(isEditFormIncomplete(core({ description: '' }), false, false)).toBe(true);
  });

  it('mode transfert : requiert account_id ET to_account_id', () => {
    expect(isEditFormIncomplete(core({ to_account_id: '' }), true, false)).toBe(true);
    expect(isEditFormIncomplete(core({ to_account_id: '2' }), true, false)).toBe(false);
  });

  it('mode normal : requiert subcategory_id sauf si ventilé', () => {
    expect(isEditFormIncomplete(core({ subcategory_id: '' }), false, false)).toBe(true);
    expect(isEditFormIncomplete(core({ subcategory_id: '' }), false, true)).toBe(false);
  });

  it('false pour un formulaire normal complet', () => {
    expect(isEditFormIncomplete(core(), false, false)).toBe(false);
  });
});

describe('isTxFormIncomplete', () => {
  it('true si payment_method_id manquant ou 0', () => {
    expect(isTxFormIncomplete(core({ payment_method_id: '' }), undefined, false)).toBe(true);
    expect(isTxFormIncomplete(core({ payment_method_id: '0' }), undefined, false)).toBe(true);
  });

  it("true si pas de fixedAccountId et pas d'account_id", () => {
    expect(isTxFormIncomplete(core({ account_id: '' }), undefined, false)).toBe(true);
  });

  it('false si fixedAccountId rend account_id optionnel', () => {
    expect(isTxFormIncomplete(core({ account_id: '' }), 5, false)).toBe(false);
  });

  it('mode ventilé : pas de check sur subcategory_id', () => {
    expect(isTxFormIncomplete(core({ subcategory_id: '' }), undefined, true)).toBe(false);
  });
});

describe('buildSplitPayload', () => {
  it('parse subcategory_id et amount en nombres', () => {
    const splits: SplitInput[] = [
      { _key: 'a', category_id: '1', subcategory_id: '10', amount: '30' },
      { _key: 'b', category_id: '1', subcategory_id: '11', amount: '20.50' },
    ];
    expect(buildSplitPayload(splits)).toEqual([
      { subcategory_id: 10, amount: 30 },
      { subcategory_id: 11, amount: 20.5 },
    ]);
  });
});

describe('getModalTitle', () => {
  it('édition → "Modifier la transaction"', () => {
    expect(getModalTitle(true, false, false, t)).toBe('Modifier la transaction');
  });

  it('duplication d\'un transfert → "Dupliquer le transfert"', () => {
    expect(getModalTitle(false, true, true, t)).toBe('Dupliquer le transfert');
  });

  it('duplication simple → "Dupliquer la transaction"', () => {
    expect(getModalTitle(false, true, false, t)).toBe('Dupliquer la transaction');
  });

  it('création transfert → "Nouveau transfert"', () => {
    expect(getModalTitle(false, false, true, t)).toBe('Nouveau transfert');
  });

  it('création simple → "Nouvelle transaction"', () => {
    expect(getModalTitle(false, false, false, t)).toBe('Nouvelle transaction');
  });
});

describe('getSubmitLabel', () => {
  it('pending → "…"', () => {
    expect(getSubmitLabel(true, false, false, t, tc)).toBe('…');
  });

  it('édition → "Enregistrer"', () => {
    expect(getSubmitLabel(false, true, false, t, tc)).toBe('Enregistrer');
  });

  it('création transfert → "Transférer"', () => {
    expect(getSubmitLabel(false, false, true, t, tc)).toBe('Transférer');
  });

  it('création simple → "Ajouter"', () => {
    expect(getSubmitLabel(false, false, false, t, tc)).toBe('Ajouter');
  });
});

describe('getSchedulingOptions', () => {
  const SCHEDS: ScheduledTransaction[] = [
    {
      id: 1,
      account_id: 1,
      to_account_id: null,
      type: 'expense',
      amount: 50,
      description: 'Plan A',
      category_id: null,
      subcategory_id: null,
      category: null,
      subcategory: null,
      payment_method_id: null,
      payment_method: null,
      insurance_support_id: null,
      insurance_fees: 0,
      notes: null,
      recurrence_unit: 'month',
      recurrence_interval: 1,
      recurrence_day: 1,
      recurrence_month: null,
      weekend_handling: 'allow',
      start_date: '2026-01-01',
      end_date: null,
      active: 1,
      next_due_date: '2026-05-01',
    },
    {
      id: 2,
      account_id: 1,
      to_account_id: 2,
      type: 'expense',
      amount: 100,
      description: 'Transfert récurrent',
      category_id: null,
      subcategory_id: null,
      category: null,
      subcategory: null,
      payment_method_id: null,
      payment_method: null,
      insurance_support_id: null,
      insurance_fees: 0,
      notes: null,
      recurrence_unit: 'month',
      recurrence_interval: 1,
      recurrence_day: 5,
      recurrence_month: null,
      weekend_handling: 'allow',
      start_date: '2026-01-01',
      end_date: null,
      active: 1,
      next_due_date: '2026-05-05',
    },
    {
      id: 3,
      account_id: 1,
      to_account_id: null,
      type: 'income',
      amount: 200,
      description: 'Inactif',
      category_id: null,
      subcategory_id: null,
      category: null,
      subcategory: null,
      payment_method_id: null,
      payment_method: null,
      insurance_support_id: null,
      insurance_fees: 0,
      notes: null,
      recurrence_unit: 'month',
      recurrence_interval: 1,
      recurrence_day: 10,
      recurrence_month: null,
      weekend_handling: 'allow',
      start_date: '2026-01-01',
      end_date: null,
      active: 0,
      next_due_date: '2026-05-10',
    },
  ];

  it('renvoie [] hors mode édition', () => {
    expect(getSchedulingOptions(false, false, SCHEDS)).toEqual([]);
  });

  it('renvoie [] en édition de transfert', () => {
    expect(getSchedulingOptions(true, true, SCHEDS)).toEqual([]);
  });

  it('exclut les transferts (to_account_id != null)', () => {
    const result = getSchedulingOptions(true, false, SCHEDS);
    expect(result.map((s) => s.id)).not.toContain(2);
  });

  it('exclut les inactifs', () => {
    const result = getSchedulingOptions(true, false, SCHEDS);
    expect(result.map((s) => s.id)).not.toContain(3);
  });

  it('garde uniquement les plans actifs non-transferts', () => {
    expect(getSchedulingOptions(true, false, SCHEDS).map((s) => s.id)).toEqual([1]);
  });

  it('tolère scheduledList undefined', () => {
    expect(getSchedulingOptions(true, false, undefined)).toEqual([]);
  });
});
