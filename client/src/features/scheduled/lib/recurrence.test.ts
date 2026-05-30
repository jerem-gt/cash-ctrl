import { describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import type { ScheduledTransaction } from '@/types';

import { recurrenceLabel } from './recurrence';

const t = i18n.getFixedT('fr', 'scheduled');

function makeSched(overrides: Partial<ScheduledTransaction>): ScheduledTransaction {
  return {
    id: 1,
    account_id: 1,
    to_account_id: null,
    type: 'expense',
    amount: 0,
    description: '',
    subcategory_id: null,
    subcategory: '',
    category_id: 0,
    category: '',
    payment_method_id: null,
    payment_method: '',
    insurance_support_id: null,
    insurance_fees: 0,
    insurance_support_name: '',
    notes: null,
    recurrence_unit: 'day',
    recurrence_interval: 1,
    recurrence_day: null,
    recurrence_month: null,
    weekend_handling: 'allow',
    start_date: '2026-01-01',
    end_date: null,
    active: 1,
    transaction_count: 0,
    ...overrides,
  };
}

describe('recurrenceLabel', () => {
  describe('unité jour', () => {
    it('renvoie "Chaque jour" pour interval=1', () => {
      const s = makeSched({ recurrence_unit: 'day', recurrence_interval: 1 });
      expect(recurrenceLabel(s, t)).toBe('Chaque jour');
    });

    it('renvoie "Tous les N jours" pour interval>1', () => {
      const s = makeSched({ recurrence_unit: 'day', recurrence_interval: 3 });
      expect(recurrenceLabel(s, t)).toBe('Tous les 3 jours');
    });
  });

  describe('unité semaine', () => {
    it('renvoie "Chaque semaine" pour interval=1', () => {
      const s = makeSched({ recurrence_unit: 'week', recurrence_interval: 1 });
      expect(recurrenceLabel(s, t)).toBe('Chaque semaine');
    });

    it('renvoie "Toutes les N semaines" pour interval>1', () => {
      const s = makeSched({ recurrence_unit: 'week', recurrence_interval: 2 });
      expect(recurrenceLabel(s, t)).toBe('Toutes les 2 semaines');
    });
  });

  describe('unité mois', () => {
    it('renvoie "Chaque mois" si aucun jour', () => {
      const s = makeSched({
        recurrence_unit: 'month',
        recurrence_interval: 1,
        recurrence_day: null,
      });
      expect(recurrenceLabel(s, t)).toBe('Chaque mois');
    });

    it('renvoie "Chaque mois le N" si jour défini', () => {
      const s = makeSched({ recurrence_unit: 'month', recurrence_interval: 1, recurrence_day: 15 });
      expect(recurrenceLabel(s, t)).toBe('Chaque mois le 15');
    });

    it('renvoie "Tous les N mois" pour interval>1 sans jour', () => {
      const s = makeSched({
        recurrence_unit: 'month',
        recurrence_interval: 2,
        recurrence_day: null,
      });
      expect(recurrenceLabel(s, t)).toBe('Tous les 2 mois');
    });

    it('renvoie "Tous les N mois le J" pour interval>1 avec jour', () => {
      const s = makeSched({ recurrence_unit: 'month', recurrence_interval: 3, recurrence_day: 5 });
      expect(recurrenceLabel(s, t)).toBe('Tous les 3 mois le 5');
    });
  });

  describe('unité année', () => {
    it('renvoie "Chaque année" si ni jour ni mois', () => {
      const s = makeSched({
        recurrence_unit: 'year',
        recurrence_interval: 1,
        recurrence_day: null,
        recurrence_month: null,
      });
      expect(recurrenceLabel(s, t)).toBe('Chaque année');
    });

    it('renvoie "Chaque année le J Mois" si jour et mois définis', () => {
      const s = makeSched({
        recurrence_unit: 'year',
        recurrence_interval: 1,
        recurrence_day: 10,
        recurrence_month: 3,
      });
      expect(recurrenceLabel(s, t)).toBe('Chaque année le 10 Mars');
    });

    it('renvoie "Tous les N ans" sans jour ni mois', () => {
      const s = makeSched({
        recurrence_unit: 'year',
        recurrence_interval: 2,
        recurrence_day: null,
        recurrence_month: null,
      });
      expect(recurrenceLabel(s, t)).toBe('Tous les 2 ans');
    });

    it('renvoie "Tous les N ans le J Mois" pour interval>1 avec date', () => {
      const s = makeSched({
        recurrence_unit: 'year',
        recurrence_interval: 5,
        recurrence_day: 1,
        recurrence_month: 1,
      });
      expect(recurrenceLabel(s, t)).toBe('Tous les 5 ans le 1 Janvier');
    });
  });
});
