import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { parseNumberParam } from './routeHelpers';

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
    expect(json).toHaveBeenCalledWith({ error: 'Paramètre id invalide' });
  });

  it('respecte le nom de paramètre fourni dans le message', () => {
    const res = mockRes();
    expect(parseNumberParam(mockReq({ year: 'xx' }), res, 'year')).toBeNull();
    expect(res.body).toEqual({ error: 'Paramètre year invalide' });
  });
});
