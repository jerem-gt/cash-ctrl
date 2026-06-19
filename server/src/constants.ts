export type {
  InsuranceOperationType,
  InsuranceSupportType,
  RecurrenceUnit,
  ReimbursementStatus,
  StockOperationType,
  TransactionType,
  WeekendHandling,
} from '@cashctrl/types';

export const RECURRENCE_UNITS = ['day', 'week', 'month', 'year'] as const;
export const REIMBURSEMENT_STATUSES = ['en_attente', 'rembourse'] as const;
export const STOCK_OPERATION_TYPES = ['buy', 'sell', 'transfer_in', 'transfer_out'] as const;
export const TRANSACTION_TYPES = ['income', 'expense'] as const;
export const WEEKEND_HANDLING = ['allow', 'before', 'after'] as const;
export const INSURANCE_OPERATION_TYPES = [
  'versement',
  'rachat',
  'arbitrage_in',
  'arbitrage_out',
  'interets',
  'revalorisation',
] as const;
export const INSURANCE_SUPPORT_TYPES = ['uc', 'euro'] as const;
export const ENVELOPE_TYPES = ['life_insurance', 'per', 'investment', 'loan', 'savings'] as const;

export const MAX_PAGE_SIZE = 10000;

export type EnvelopeType = (typeof ENVELOPE_TYPES)[number];
