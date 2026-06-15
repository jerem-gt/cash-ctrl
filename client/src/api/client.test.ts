import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { server } from '@/tests/msw/server';

import { transactionsApi } from './client';

describe('parseResponse / extractError', () => {
  // i18n est un singleton partagé (isolate: false) : toujours revenir au FR.
  afterEach(async () => {
    await i18n.changeLanguage('fr');
  });

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

  it('utilise un message générique si le corps est vide', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.json({}, { status: 500 })));
    await expect(transactionsApi.list()).rejects.toThrow('Erreur interne du serveur.');
  });

  it('traduit un code métier structuré + params (FR)', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json(
          { error: { code: 'bank.in_use', message: 'fallback', params: { count: 2 } } },
          { status: 409 },
        ),
      ),
    );
    await expect(transactionsApi.list()).rejects.toThrow(
      'Cette banque est utilisée par 2 compte(s).',
    );
  });

  it('traduit le code selon la langue active (EN)', async () => {
    await i18n.changeLanguage('en');
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json(
          { error: { code: 'bank.in_use', message: 'fallback', params: { count: 2 } } },
          { status: 409 },
        ),
      ),
    );
    await expect(transactionsApi.list()).rejects.toThrow('This bank is used by 2 account(s).');
  });

  it('joint les erreurs de validation par champ', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json(
          {
            error: {
              code: 'validation.invalid',
              message: 'Données invalides',
              fields: [
                { path: 'amount', code: 'validation.required', message: 'r' },
                {
                  path: 'name',
                  code: 'validation.too_short',
                  params: { minimum: 2 },
                  message: 's',
                },
              ],
            },
          },
          { status: 400 },
        ),
      ),
    );
    await expect(transactionsApi.list()).rejects.toThrow(
      /Ce champ est requis.*Doit contenir au moins 2/,
    );
  });

  it('se replie sur le message serveur si le code est inconnu', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json(
          { error: { code: 'totally.unknown', message: 'Repli serveur' } },
          { status: 400 },
        ),
      ),
    );
    await expect(transactionsApi.list()).rejects.toThrow('Repli serveur');
  });

  it('lance une ApiError traduite quand fetch échoue (réseau indisponible)', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.error()));
    const err = await transactionsApi.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Serveur inaccessible. Vérifiez votre connexion.');
    expect((err as { status: number }).status).toBe(0);
  });
});
