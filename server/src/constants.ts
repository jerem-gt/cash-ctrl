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
] as const;
export const INSURANCE_SUPPORT_TYPES = ['uc', 'euro'] as const;
export const ENVELOPE_TYPES = ['assurance_vie', 'per'] as const;

export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number];
export type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];
export type StockOperationType = (typeof STOCK_OPERATION_TYPES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type WeekendHandling = (typeof WEEKEND_HANDLING)[number];
export type InsuranceOperationType = (typeof INSURANCE_OPERATION_TYPES)[number];
export type InsuranceSupportType = (typeof INSURANCE_SUPPORT_TYPES)[number];
export type EnvelopeType = (typeof ENVELOPE_TYPES)[number];
