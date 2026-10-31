import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { currentUserId, requireAuth } from './middleware.js';

function mockReq(session: Partial<{ userId: number }> = {}): Request {
  return { session } as unknown as Request;
}

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn(), locals: {} as Record<string, unknown> };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

describe('requireAuth', () => {
  it('calls next() when userId is present in session', () => {
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(mockReq({ userId: 1 }), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 when session has no userId', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(mockReq(), res, next);
    expect(res.status as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('currentUserId', () => {
  it('lit le compte posé par requireAuth', () => {
    const res = mockRes();
    requireAuth(mockReq({ userId: 7 }), res, vi.fn());
    expect(currentUserId(res)).toBe(7);
  });
});
