import { zodToApiError } from '@jerem-gt/ctrl-shared/server/apiErrors';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { HttpError } from './errors.js';
import { assertFound, makeCheckAccount, parseIdParam } from './routeHelpers.js';

function mockReq(params: Record<string, string>): Request {
  return { params } as unknown as Request;
}

/** L'erreur levée par `fn`, pour en vérifier le statut, le code et les paramètres. */
function thrown(fn: () => unknown): HttpError {
  try {
    fn();
  } catch (err) {
    if (err instanceof HttpError) return err;
    throw err;
  }
  throw new Error('aucune erreur levée');
}

describe('parseIdParam', () => {
  it('retourne le nombre pour un id numérique valide', () => {
    expect(parseIdParam(mockReq({ id: '42' }))).toBe(42);
  });

  it('utilise le radix 10 (pas d’octal sur les zéros initiaux)', () => {
    expect(parseIdParam(mockReq({ id: '011' }))).toBe(11);
  });

  it('lève 400 common.invalid_param pour une valeur non numérique', () => {
    const err = thrown(() => parseIdParam(mockReq({ id: 'abc' })));
    expect(err).toMatchObject({
      status: 400,
      code: 'common.invalid_param',
      params: { param: 'id' },
    });
  });

  it('nomme le paramètre fourni', () => {
    const err = thrown(() => parseIdParam(mockReq({ year: 'xx' }), 'year'));
    expect(err.params).toEqual({ param: 'year' });
  });
});

describe('assertFound', () => {
  const repo = { getById: (id: number) => (id === 1 ? { id } : undefined) };

  it('laisse passer un objet existant', () => {
    expect(() => assertFound(repo, 1, 'category.not_found')).not.toThrow();
  });

  it('lève 404 avec le code fourni sinon', () => {
    expect(thrown(() => assertFound(repo, 2, 'category.not_found'))).toMatchObject({
      status: 404,
      code: 'category.not_found',
    });
  });
});

describe('makeCheckAccount', () => {
  const check = makeCheckAccount((accountId, userId) => accountId === 7 && userId === 1);
  const run = (accountId: string) => {
    const res = { locals: { userId: 1 } } as unknown as Response;
    const next = vi.fn();
    check({ params: { accountId } } as unknown as Request, res, next as NextFunction);
    return { res, next };
  };

  it('pose le compte de la route et passe la main s’il appartient à l’utilisateur', () => {
    const { res, next } = run('7');
    expect(res.locals.accountId).toBe(7);
    expect(next).toHaveBeenCalledOnce();
  });

  it('lève 404 account.not_found pour le compte d’un autre utilisateur', () => {
    expect(thrown(() => run('8'))).toMatchObject({ status: 404, code: 'account.not_found' });
  });
});

describe('zodToApiError (ctrl-shared, codes du registre)', () => {
  const schema = z.object({
    name: z.string().min(2),
    amount: z.number().positive(),
    type: z.enum(['a', 'b']),
  });

  it('renvoie le code générique + un détail par champ traduisible', () => {
    const parsed = schema.safeParse({ name: 'x', type: 'c' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const body = zodToApiError(parsed.error);
    expect(body.code).toBe('validation.invalid');
    expect(body.message).toBe('Données invalides');

    const byPath = Object.fromEntries(body.fields.map((f) => [f.path, f]));
    expect(byPath.amount.code).toBe('validation.required'); // champ manquant
    expect(byPath.name.code).toBe('validation.too_short');
    expect(byPath.name.params).toEqual({ minimum: 2 });
    expect(byPath.type.code).toBe('validation.invalid_value');
    // chaque champ porte un message FR de repli non vide
    for (const f of body.fields) expect(f.message.length).toBeGreaterThan(0);
  });

  it('distingue une valeur du mauvais type d’un champ manquant', () => {
    const parsed = schema.safeParse({ name: 'ok', amount: 'douze', type: 'a' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const [field] = zodToApiError(parsed.error).fields;
    expect(field).toMatchObject({ path: 'amount', code: 'validation.invalid_type' });
  });
});
