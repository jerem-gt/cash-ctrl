import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { parseNumberParam, zodToApiError } from './routeHelpers';

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function mockReq(params: Record<string, string>): Request {
  return { params } as unknown as Request;
}

describe('parseNumberParam', () => {
  it('retourne le nombre pour un id numérique valide', () => {
    const res = mockRes();
    expect(parseNumberParam(mockReq({ id: '42' }), res)).toBe(42);
    expect(res.statusCode).toBe(0);
  });

  it('utilise le radix 10 (pas d’octal sur les zéros initiaux)', () => {
    const res = mockRes();
    expect(parseNumberParam(mockReq({ id: '011' }), res)).toBe(11);
  });

  it('répond 400 et renvoie null pour une valeur non numérique', () => {
    const res = mockRes();
    const json = vi.spyOn(res, 'json');
    expect(parseNumberParam(mockReq({ id: 'abc' }), res)).toBeNull();
    expect(res.statusCode).toBe(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'common.invalid_param',
        message: 'Paramètre id invalide',
        params: { param: 'id' },
      },
    });
  });

  it('respecte le nom de paramètre fourni dans le message', () => {
    const res = mockRes();
    expect(parseNumberParam(mockReq({ year: 'xx' }), res, 'year')).toBeNull();
    expect(res.body).toEqual({
      error: {
        code: 'common.invalid_param',
        message: 'Paramètre year invalide',
        params: { param: 'year' },
      },
    });
  });
});

describe('zodToApiError', () => {
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
});
