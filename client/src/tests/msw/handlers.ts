import { http, HttpResponse } from 'msw';

import {
  ACCOUNT_TYPES,
  ACCOUNTS,
  BANKS,
  CATEGORIES,
  LOAN,
  LOAN_INSTALLMENTS,
  PAYMENT_METHODS,
  PENDING_REIMBURSEMENTS,
  REIMBURSEMENTS,
  SCHEDULED,
  STOCK_OPERATIONS,
  STOCK_POSITIONS,
  SUBCATEGORIES,
  TRANSACTIONS,
} from '../fixtures';

export const handlers = [
  // Auth
  http.get('/api/auth/me', () => HttpResponse.json({ username: 'test' })),
  http.post('/api/auth/login', () => HttpResponse.json({ username: 'test' })),
  http.post('/api/auth/logout', () => HttpResponse.json({ ok: true })),
  http.post('/api/auth/change-password', () => HttpResponse.json({ ok: true })),

  // Version
  http.get('/api/version', () => HttpResponse.json({ version: 'development' })),

  // Accounts
  http.get('/api/accounts', () => HttpResponse.json(ACCOUNTS)),
  http.post('/api/accounts', () => HttpResponse.json({ ...ACCOUNTS[0], id: 99, name: 'Nouveau' })),
  http.put('/api/accounts/:id', () => HttpResponse.json(ACCOUNTS[0])),
  http.delete('/api/accounts/:id', () => HttpResponse.json({ ok: true })),
  http.post('/api/accounts/:id/close', () =>
    HttpResponse.json({ ...ACCOUNTS[0], closed_at: '2025-01-01' }),
  ),
  http.post('/api/accounts/:id/reopen', () =>
    HttpResponse.json({ ...ACCOUNTS[0], closed_at: null }),
  ),

  // Account types
  http.get('/api/account-types', () => HttpResponse.json(ACCOUNT_TYPES)),
  http.post('/api/account-types', () => HttpResponse.json({ id: 99, name: 'Nouveau type' })),
  http.put('/api/account-types/:id', () => HttpResponse.json(ACCOUNT_TYPES[0])),
  http.delete('/api/account-types/:id', () => HttpResponse.json({ ok: true })),

  // Banks
  http.get('/api/banks', () => HttpResponse.json(BANKS)),
  http.post('/api/banks', () =>
    HttpResponse.json({ id: 99, name: 'Nouvelle banque', logo: null, domain: null }),
  ),
  http.put('/api/banks/:id', () => HttpResponse.json(BANKS[0])),
  http.delete('/api/banks/:id', () => HttpResponse.json({ ok: true })),

  // Categories
  http.get('/api/categories', () => HttpResponse.json(CATEGORIES)),
  http.post('/api/categories', () =>
    HttpResponse.json({ id: 99, name: 'Nouvelle cat', color: '#ffffff' }),
  ),
  http.put('/api/categories/:id', () => HttpResponse.json(CATEGORIES[0])),
  http.delete('/api/categories/:id', () => HttpResponse.json({ ok: true })),

  // Subcategories
  http.post('/api/subcategories', () =>
    HttpResponse.json({ id: 99, name: 'Nouvelle subcat', category_id: 99 }),
  ),
  http.put('/api/subcategories/:id', () => HttpResponse.json(SUBCATEGORIES[0])),
  http.delete('/api/subcategories/:id', () => HttpResponse.json({ ok: true })),

  // Payment methods
  http.get('/api/payment-methods', () => HttpResponse.json(PAYMENT_METHODS)),
  http.post('/api/payment-methods', () =>
    HttpResponse.json({ id: 99, name: 'Nouveau PM', icon: '💰' }),
  ),
  http.put('/api/payment-methods/:id', () => HttpResponse.json(PAYMENT_METHODS[0])),
  http.delete('/api/payment-methods/:id', () => HttpResponse.json({ ok: true })),

  // Transactions
  http.get('/api/transactions', () => HttpResponse.json(TRANSACTIONS)),
  http.post('/api/transactions', () => HttpResponse.json(TRANSACTIONS.data[0])),
  http.put('/api/transactions/:id', () => HttpResponse.json(TRANSACTIONS.data[0])),
  http.patch('/api/transactions/:id/validate', () =>
    HttpResponse.json({ ...TRANSACTIONS.data[0], validated: 1 }),
  ),
  http.delete('/api/transactions/:id', () => HttpResponse.json({ ok: true })),

  // Transfers
  http.post('/api/transfers', () =>
    HttpResponse.json({ expense: TRANSACTIONS.data[0], income: TRANSACTIONS.data[0] }),
  ),
  http.put('/api/transfers/:id', () => HttpResponse.json(TRANSACTIONS.data[0])),
  http.delete('/api/transfers/:id', () => HttpResponse.json({ ok: true })),

  // Scheduled
  http.get('/api/scheduled', () => HttpResponse.json(SCHEDULED)),
  http.post('/api/scheduled', () => HttpResponse.json({ ...SCHEDULED[0], id: 99 })),
  http.put('/api/scheduled/:id', () => HttpResponse.json(SCHEDULED[0])),
  http.delete('/api/scheduled/:id', () => HttpResponse.json({ ok: true })),

  // Settings
  http.get('/api/settings', () => HttpResponse.json({ lead_days: 3 })),
  http.put('/api/settings', () => HttpResponse.json({ lead_days: 30 })),

  // Reimbursements
  http.get('/api/reimbursements/pending', () => HttpResponse.json(PENDING_REIMBURSEMENTS)),
  http.get('/api/reimbursements/:transactionId', () => HttpResponse.json(REIMBURSEMENTS)),
  http.post('/api/reimbursements/:transactionId', () =>
    HttpResponse.json(REIMBURSEMENTS, { status: 201 }),
  ),
  http.delete('/api/reimbursements/:transactionId/:linkedId', () =>
    HttpResponse.json({ ok: true }),
  ),
  http.patch('/api/reimbursements/:transactionId/status', () =>
    HttpResponse.json({ ...TRANSACTIONS.data[0], reimbursement_status: 'en_attente' }),
  ),

  // Export
  http.get(
    '/api/export/csv',
    () => new HttpResponse(new Blob(['col1,col2'], { type: 'text/csv' })),
  ),
  http.get(
    '/api/export/json',
    () => new HttpResponse(new Blob(['[]'], { type: 'application/json' })),
  ),

  // Loans (specific patterns before generic /:loanId)
  http.get('/api/loans/account/:accountId', () => HttpResponse.json(LOAN)),
  http.get('/api/loans/:loanId/installments', () => HttpResponse.json(LOAN_INSTALLMENTS)),
  http.post('/api/loans', () => HttpResponse.json(LOAN, { status: 201 })),
  http.patch('/api/loans/:loanId/installments/:installmentId', () =>
    HttpResponse.json(LOAN_INSTALLMENTS[0]),
  ),
  http.patch('/api/loans/:loanId', () => HttpResponse.json(LOAN)),

  // Stocks
  http.get('/api/stocks/:accountId/positions', () => HttpResponse.json(STOCK_POSITIONS)),
  http.get('/api/stocks/:accountId/operations', () => HttpResponse.json(STOCK_OPERATIONS)),
  http.post('/api/stocks/:accountId/buy', () =>
    HttpResponse.json({ operation: STOCK_OPERATIONS[0], transaction_id: 20 }, { status: 201 }),
  ),
  http.post('/api/stocks/:accountId/sell', () =>
    HttpResponse.json(
      { operation: { ...STOCK_OPERATIONS[0], type: 'sell' }, transaction_id: 21 },
      { status: 201 },
    ),
  ),
  http.put('/api/stocks/:accountId/operations/:operationId', () =>
    HttpResponse.json(STOCK_OPERATIONS[0]),
  ),
  http.get('/api/stocks/price/:ticker', () =>
    HttpResponse.json({
      ticker: 'DCAM.PA',
      price: 15,
      currency: 'EUR',
      fetched_at: '2026-05-01T10:00:00',
    }),
  ),
  http.post('/api/stocks/prices/refresh', () => HttpResponse.json({ ok: true })),
];
