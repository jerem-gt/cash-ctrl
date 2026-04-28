import { http, HttpResponse } from 'msw';

import {
  ACCOUNT_TYPES,
  ACCOUNTS,
  BANKS,
  CATEGORIES,
  PAYMENT_METHODS,
  SCHEDULED,
  SUBCATEGORIES,
  TRANSACTIONS,
} from '../fixtures';

export const handlers = [
  // Auth
  http.get('/api/auth/me', () => HttpResponse.json({ username: 'test' })),
  http.post('/api/auth/login', () => HttpResponse.json({ username: 'test' })),
  http.post('/api/auth/logout', () => HttpResponse.json({ ok: true })),
  http.post('/api/auth/change-password', () => HttpResponse.json({ ok: true })),

  // Accounts
  http.get('/api/accounts', () => HttpResponse.json(ACCOUNTS)),
  http.post('/api/accounts', () => HttpResponse.json({ ...ACCOUNTS[0], id: 99, name: 'Nouveau' })),
  http.put('/api/accounts/:id', () => HttpResponse.json(ACCOUNTS[0])),
  http.delete('/api/accounts/:id', () => HttpResponse.json({ ok: true })),

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

  // Scheduled
  http.get('/api/scheduled', () => HttpResponse.json(SCHEDULED)),
  http.post('/api/scheduled', () => HttpResponse.json({ ...SCHEDULED[0], id: 99 })),
  http.put('/api/scheduled/:id', () => HttpResponse.json(SCHEDULED[0])),
  http.delete('/api/scheduled/:id', () => HttpResponse.json({ ok: true })),

  // Settings
  http.get('/api/settings', () => HttpResponse.json({ lead_days: 3 })),
  http.put('/api/settings', () => HttpResponse.json({ lead_days: 30 })),

  // Export
  http.get(
    '/api/export/csv',
    () => new HttpResponse(new Blob(['col1,col2'], { type: 'text/csv' })),
  ),
  http.get(
    '/api/export/json',
    () => new HttpResponse(new Blob(['[]'], { type: 'application/json' })),
  ),
];
