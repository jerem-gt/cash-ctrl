import { describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import type { Account, ScheduledTransaction } from '@/types';

import {
  buildVersementDescription,
  emptyForm,
  formToPayload,
  isInsuranceAccount,
  schedToForm,
} from './form';

const t = i18n.getFixedT('fr', 'scheduled');

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: 'Compte courant',
    bank_id: null,
    bank: '',
    account_type_id: null,
    type: '',
    envelope_type: null,
    initial_balance: 0,
    opening_date: null,
    closed_at: null,
    balance: 0,
    balance_all: 0,
    balance_stocks: 0,
    balance_insurance: 0,
    capital_restant_du: null,
    capital_restant_du_all: null,
    ...overrides,
  };
}

function makeSched(overrides: Partial<ScheduledTransaction> = {}): ScheduledTransaction {
  return {
    id: 42,
    account_id: 10,
    to_account_id: null,
    type: 'expense',
    amount: 25.5,
    description: 'Abonnement Netflix',
    subcategory_id: 7,
    subcategory: 'Loisirs',
    category_id: 3,
    category: 'Vie courante',
    payment_method_id: 2,
    payment_method: 'CB',
    insurance_support_id: null,
    insurance_fees: 0,
    insurance_support_name: '',
    notes: 'note libre',
    recurrence_unit: 'month',
    recurrence_interval: 1,
    recurrence_day: 5,
    recurrence_month: null,
    weekend_handling: 'allow',
    start_date: '2026-01-05',
    end_date: null,
    active: 1,
    transaction_count: 0,
    ...overrides,
  };
}

// ─── isInsuranceAccount ────────────────────────────────────────────────────────

describe('isInsuranceAccount', () => {
  it('vrai pour life_insurance', () => {
    expect(isInsuranceAccount(makeAccount({ envelope_type: 'life_insurance' }))).toBe(true);
  });

  it('vrai pour per', () => {
    expect(isInsuranceAccount(makeAccount({ envelope_type: 'per' }))).toBe(true);
  });

  it('faux pour les autres enveloppes', () => {
    expect(isInsuranceAccount(makeAccount({ envelope_type: null }))).toBe(false);
    expect(isInsuranceAccount(makeAccount({ envelope_type: 'loan' }))).toBe(false);
  });
});

// ─── emptyForm ────────────────────────────────────────────────────────────────

describe('emptyForm', () => {
  it('initialise en mode transaction expense', () => {
    const f = emptyForm();
    expect(f.mode).toBe('transaction');
    expect(f.type).toBe('expense');
    expect(f.active).toBe(true);
    expect(f.weekend_handling).toBe('allow');
    expect(f.recurrence_unit).toBe('month');
    expect(f.recurrence_interval).toBe('1');
  });

  it("renseigne start_date au format YYYY-MM-DD d'aujourd'hui", () => {
    const f = emptyForm();
    expect(f.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('défaut account_id vide si non fourni', () => {
    expect(emptyForm().account_id).toBe('');
  });

  it('pré-remplit account_id si defaultAccountId fourni', () => {
    expect(emptyForm(7).account_id).toBe('7');
  });
});

// ─── schedToForm ──────────────────────────────────────────────────────────────

describe('schedToForm', () => {
  it('détecte mode transaction quand pas de to_account_id ni support', () => {
    const f = schedToForm(makeSched({ to_account_id: null, insurance_support_id: null }));
    expect(f.mode).toBe('transaction');
    expect(f.amount).toBe('25.50');
    expect(f.recurrence_day).toBe('5');
  });

  it('détecte mode transfer quand to_account_id sans support', () => {
    const f = schedToForm(makeSched({ to_account_id: 20, insurance_support_id: null }));
    expect(f.mode).toBe('transfer');
    expect(f.to_account_id).toBe('20');
  });

  it('détecte mode versement quand insurance_support_id est défini', () => {
    const f = schedToForm(
      makeSched({ to_account_id: 30, insurance_support_id: 99, insurance_fees: 1.2 }),
    );
    expect(f.mode).toBe('versement');
    expect(f.insurance_support_id).toBe('99');
    expect(f.insurance_fees).toBe('1.20');
    expect(f.to_account_id).toBe('30');
  });

  it('mappe les valeurs nullables en string vide', () => {
    const f = schedToForm(
      makeSched({
        subcategory_id: null,
        payment_method_id: null,
        notes: null,
        end_date: null,
        recurrence_day: null,
        recurrence_month: null,
      }),
    );
    expect(f.subcategory_id).toBe('');
    expect(f.payment_method_id).toBe('');
    expect(f.notes).toBe('');
    expect(f.end_date).toBe('');
    expect(f.recurrence_day).toBe('1');
    expect(f.recurrence_month).toBe('1');
  });

  it('mappe active=1 vers true et 0 vers false', () => {
    expect(schedToForm(makeSched({ active: 1 })).active).toBe(true);
    expect(schedToForm(makeSched({ active: 0 })).active).toBe(false);
  });
});

// ─── formToPayload ────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { id: 1, name: 'CB' },
  { id: 9, name: 'Transfert' },
];

describe('formToPayload', () => {
  describe('mode transaction', () => {
    it('mappe les champs et nullise les champs transfer/versement', () => {
      const form = emptyForm();
      const p = formToPayload(
        {
          ...form,
          mode: 'transaction',
          type: 'income',
          account_id: '10',
          amount: '125.50',
          description: '  Salaire  ',
          subcategory_id: '7',
          payment_method_id: '1',
          notes: '  note  ',
          recurrence_interval: '2',
        },
        PAYMENT_METHODS,
      );
      expect(p).toMatchObject({
        account_id: 10,
        to_account_id: null,
        type: 'income',
        amount: 125.5,
        description: 'Salaire',
        notes: 'note',
        subcategory_id: 7,
        payment_method_id: 1,
        insurance_support_id: null,
        insurance_fees: 0,
        recurrence_interval: 2,
      });
    });

    it('met recurrence_day/month à null si unité = day', () => {
      const p = formToPayload(
        { ...emptyForm(), account_id: '1', amount: '10', recurrence_unit: 'day' },
        PAYMENT_METHODS,
      );
      expect(p.recurrence_day).toBeNull();
      expect(p.recurrence_month).toBeNull();
    });

    it('garde recurrence_day pour month et nullise month', () => {
      const p = formToPayload(
        {
          ...emptyForm(),
          account_id: '1',
          amount: '10',
          recurrence_unit: 'month',
          recurrence_day: '15',
        },
        PAYMENT_METHODS,
      );
      expect(p.recurrence_day).toBe(15);
      expect(p.recurrence_month).toBeNull();
    });

    it('garde recurrence_day et recurrence_month pour year', () => {
      const p = formToPayload(
        {
          ...emptyForm(),
          account_id: '1',
          amount: '10',
          recurrence_unit: 'year',
          recurrence_day: '1',
          recurrence_month: '6',
        },
        PAYMENT_METHODS,
      );
      expect(p.recurrence_day).toBe(1);
      expect(p.recurrence_month).toBe(6);
    });

    it('end_date vide → null', () => {
      const p = formToPayload(
        { ...emptyForm(), account_id: '1', amount: '10', end_date: '' },
        PAYMENT_METHODS,
      );
      expect(p.end_date).toBeNull();
    });

    it('notes vides ou espaces → null', () => {
      const p = formToPayload(
        { ...emptyForm(), account_id: '1', amount: '10', notes: '   ' },
        PAYMENT_METHODS,
      );
      expect(p.notes).toBeNull();
    });
  });

  describe('mode transfer', () => {
    it('force type=expense, résout payment_method "Transfert" et nullise subcategory/insurance', () => {
      const p = formToPayload(
        {
          ...emptyForm(),
          mode: 'transfer',
          account_id: '10',
          to_account_id: '20',
          amount: '300',
          type: 'income', // ignoré
          subcategory_id: '7', // ignoré
        },
        PAYMENT_METHODS,
      );
      expect(p.type).toBe('expense');
      expect(p.account_id).toBe(10);
      expect(p.to_account_id).toBe(20);
      expect(p.subcategory_id).toBeNull();
      expect(p.payment_method_id).toBe(9); // id du PM "Transfert"
      expect(p.insurance_support_id).toBeNull();
      expect(p.insurance_fees).toBe(0);
    });

    it('payment_method_id null si pas de PM "Transfert"', () => {
      const p = formToPayload(
        {
          ...emptyForm(),
          mode: 'transfer',
          account_id: '10',
          to_account_id: '20',
          amount: '300',
        },
        [{ id: 1, name: 'CB' }],
      );
      expect(p.payment_method_id).toBeNull();
    });
  });

  describe('mode versement', () => {
    it('mappe support et fees, force type=expense', () => {
      const p = formToPayload(
        {
          ...emptyForm(),
          mode: 'versement',
          account_id: '10',
          to_account_id: '30',
          insurance_support_id: '5',
          insurance_fees: '2.50',
          amount: '500',
        },
        PAYMENT_METHODS,
      );
      expect(p.type).toBe('expense');
      expect(p.account_id).toBe(10);
      expect(p.to_account_id).toBe(30);
      expect(p.insurance_support_id).toBe(5);
      expect(p.insurance_fees).toBe(2.5);
      expect(p.subcategory_id).toBeNull();
      expect(p.payment_method_id).toBeNull();
    });

    it('to_account_id null si vide', () => {
      const p = formToPayload(
        {
          ...emptyForm(),
          mode: 'versement',
          account_id: '10',
          to_account_id: '',
          insurance_support_id: '5',
          amount: '100',
        },
        PAYMENT_METHODS,
      );
      expect(p.to_account_id).toBeNull();
    });
  });
});

// ─── buildVersementDescription ────────────────────────────────────────────────

describe('buildVersementDescription', () => {
  it('renvoie chaîne vide si support undefined', () => {
    expect(buildVersementDescription('Mon AV', undefined, t)).toBe('');
  });

  it('formate UC avec préfixe compte', () => {
    expect(buildVersementDescription('Mon AV', { name: 'Amundi MSCI', type: 'uc' }, t)).toBe(
      'Versement UC — Mon AV · Amundi MSCI',
    );
  });

  it('formate Euro avec préfixe compte', () => {
    expect(
      buildVersementDescription('PER Lucya', { name: 'Fonds Eurossima', type: 'euro' }, t),
    ).toBe('Versement fonds euro — PER Lucya · Fonds Eurossima');
  });

  it('omet le préfixe si accountName vide', () => {
    expect(buildVersementDescription('', { name: 'Eurossima', type: 'euro' }, t)).toBe(
      'Versement fonds euro — Eurossima',
    );
  });
});
