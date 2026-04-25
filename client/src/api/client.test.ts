import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/tests/msw/server';

import { transactionsApi } from './client';

describe('parseResponse / extractError', () => {
  it('résout avec les données si la réponse est ok', async () => {
    const result = await transactionsApi.list();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('lève une erreur avec un message string simple', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ error: 'Non autorisé' }, { status: 401 }),
      ),
    );
    await expect(transactionsApi.list()).rejects.toThrow('Non autorisé');
  });

  it('extrait les _errors Zod imbriqués', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ error: { amount: { _errors: ['Nombre requis'] } } }, { status: 400 }),
      ),
    );
    await expect(transactionsApi.list()).rejects.toThrow('Nombre requis');
  });

  it('joint plusieurs erreurs avec ·', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json(
          { error: { a: { _errors: ['champ A'] }, b: { _errors: ['champ B'] } } },
          { status: 400 },
        ),
      ),
    );
    await expect(transactionsApi.list()).rejects.toThrow(/champ A.*champ B/);
  });

  it('utilise "Request failed" si le corps d\'erreur est vide', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.json({}, { status: 500 })));
    await expect(transactionsApi.list()).rejects.toThrow('Request failed');
  });
});
