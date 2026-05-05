export const RECURRENCE_UNITS = ['day', 'week', 'month', 'year'] as const;
export const REIMBURSEMENT_STATUSES = ['en_attente', 'rembourse'] as const;
export const STOCK_OPERATION_TYPES = ['buy', 'sell'] as const;
export const TRANSACTION_TYPES = ['income', 'expense'] as const;
export const WEEKEND_HANDLING = ['allow', 'before', 'after'] as const;

export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number];
export type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];
export type StockOperationType = (typeof STOCK_OPERATION_TYPES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type WeekendHandling = (typeof WEEKEND_HANDLING)[number];
