import type { TransactionFilters } from '@/types';

export const queryKeys = {
  accounts: () => ['accounts'] as const,
  accountTypes: () => ['account-types'] as const,
  banks: () => ['banks'] as const,
  categories: () => ['categories'] as const,
  paymentMethods: () => ['payment-methods'] as const,
  scheduled: () => ['scheduled'] as const,
  settings: () => ['settings'] as const,
  users: () => ['users'] as const,
  me: () => ['me'] as const,
  version: () => ['version'] as const,
  dashboardStats: () => ['dashboard-stats'] as const,
  balanceHistory: () => ['balance-history'] as const,
  profitability: () => ['profitability'] as const,

  transactions: {
    all: () => ['transactions'] as const,
    list: (filters?: TransactionFilters) => ['transactions', filters] as const,
  },

  stockPositions: {
    all: () => ['stock-positions'] as const,
    byAccount: (accountId: number) => ['stock-positions', accountId] as const,
  },
  stockOperations: (accountId: number) => ['stock-operations', accountId] as const,
  stockSearch: (query: string) => ['stock-search', query] as const,

  insurancePositions: (accountId: number) => ['insurance-positions', accountId] as const,
  insuranceOperations: (accountId: number) => ['insurance-operations', accountId] as const,
  insuranceSupports: (accountId: number) => ['insurance-supports', accountId] as const,

  loanByAccount: (accountId: number) => ['loans', 'account', accountId] as const,
  loanInstallments: (loanId: number | undefined) => ['loans', 'installments', loanId] as const,

  reimbursements: (transactionId: number) => ['reimbursements', transactionId] as const,
  reimbursementsPending: () => ['reimbursements', 'pending'] as const,
  reimbursementsRecent: () => ['reimbursements', 'recent'] as const,

  taxYears: () => ['tax', 'years'] as const,
  taxYear: (year: number | undefined) => ['tax', 'year', year] as const,
};
