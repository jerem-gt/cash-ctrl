import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalErrorHandler, logger, requestLogger } from './logger.js';

function mockReq(method = 'GET', path = '/test'): Request {
  return { method, path } as unknown as Request;
}

function mockRes(statusCode = 200) {
  const handlers: Record<string, () => void> = {};
  const res = {
    statusCode,
    on: vi.fn((event: string, cb: () => void) => {
      handlers[event] = cb;
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  return {
    res: res as unknown as Response,
    triggerFinish: () => handlers['finish']?.(),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// logger – silence
// ──────────────────────────────────────────────────────────────────────────────

describe('logger – IS_SILENT (NODE_ENV=test)', () => {
  it('never writes to stdout for any level', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// logger – production mode (re-import avec NODE_ENV=production)
// ──────────────────────────────────────────────────────────────────────────────

describe('logger – production mode', () => {
  let mod: typeof import('./logger.js');
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'DEBUG');
    vi.resetModules();
    mod = await import('./logger.js');
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('debug écrit sur stdout avec la couleur GRAY', () => {
    mod.logger.debug('msg');
    expect(writeSpy).toHaveBeenCalledOnce();
    const out = String(writeSpy.mock.calls[0][0]);
    expect(out).toContain('\x1b[90m');
    expect(out).toContain('DEBUG');
    expect(out).toContain('msg');
  });

  it('info écrit sur stdout avec la couleur GREEN', () => {
    mod.logger.info('msg');
    expect(writeSpy).toHaveBeenCalledOnce();
    expect(String(writeSpy.mock.calls[0][0])).toContain('\x1b[32m');
  });

  it('warn écrit sur stdout avec la couleur YELLOW', () => {
    mod.logger.warn('msg');
    expect(writeSpy).toHaveBeenCalledOnce();
    expect(String(writeSpy.mock.calls[0][0])).toContain('\x1b[33m');
  });

  it('error écrit sur stdout avec la couleur RED', () => {
    mod.logger.error('msg');
    expect(writeSpy).toHaveBeenCalledOnce();
    expect(String(writeSpy.mock.calls[0][0])).toContain('\x1b[31m');
  });

  it('supprime debug quand LOG_LEVEL=INFO', async () => {
    vi.stubEnv('LOG_LEVEL', 'INFO');
    vi.resetModules();
    const m = await import('./logger.js');
    m.logger.debug('hidden');
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('supprime debug et info quand LOG_LEVEL=WARN, laisse passer warn', async () => {
    vi.stubEnv('LOG_LEVEL', 'WARN');
    vi.resetModules();
    const m = await import('./logger.js');
    m.logger.debug('no');
    m.logger.info('no');
    expect(writeSpy).not.toHaveBeenCalled();
    m.logger.warn('yes');
    expect(writeSpy).toHaveBeenCalledOnce();
  });

  it('ne log que error quand LOG_LEVEL=ERROR', async () => {
    vi.stubEnv('LOG_LEVEL', 'ERROR');
    vi.resetModules();
    const m = await import('./logger.js');
    m.logger.debug('no');
    m.logger.info('no');
    m.logger.warn('no');
    expect(writeSpy).not.toHaveBeenCalled();
    m.logger.error('yes');
    expect(writeSpy).toHaveBeenCalledOnce();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// requestLogger
// ──────────────────────────────────────────────────────────────────────────────

describe('requestLogger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('appelle next()', () => {
    const next = vi.fn() as unknown as NextFunction;
    const { res } = mockRes();
    requestLogger(mockReq(), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('log error sur 5xx', () => {
    const { res, triggerFinish } = mockRes(500);
    requestLogger(mockReq('POST', '/api'), res, vi.fn() as unknown as NextFunction);
    triggerFinish();
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toContain('POST /api 500');
  });

  it('log warn sur 4xx', () => {
    const { res, triggerFinish } = mockRes(404);
    requestLogger(mockReq('GET', '/missing'), res, vi.fn() as unknown as NextFunction);
    triggerFinish();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('GET /missing 404');
  });

  it('log debug pour GET 2xx', () => {
    const { res, triggerFinish } = mockRes(200);
    requestLogger(mockReq('GET', '/data'), res, vi.fn() as unknown as NextFunction);
    triggerFinish();
    expect(debugSpy).toHaveBeenCalledOnce();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('log info pour POST 2xx', () => {
    const { res, triggerFinish } = mockRes(201);
    requestLogger(mockReq('POST', '/items'), res, vi.fn() as unknown as NextFunction);
    triggerFinish();
    expect(infoSpy).toHaveBeenCalledOnce();
  });

  it('log info pour PUT 2xx', () => {
    const { res, triggerFinish } = mockRes(200);
    requestLogger(mockReq('PUT', '/items/1'), res, vi.fn() as unknown as NextFunction);
    triggerFinish();
    expect(infoSpy).toHaveBeenCalledOnce();
  });

  it('log info pour DELETE 2xx', () => {
    const { res, triggerFinish } = mockRes(200);
    requestLogger(mockReq('DELETE', '/items/1'), res, vi.fn() as unknown as NextFunction);
    triggerFinish();
    expect(infoSpy).toHaveBeenCalledOnce();
  });

  it('inclut le temps écoulé en ms dans la ligne de log', () => {
    const { res, triggerFinish } = mockRes(201);
    requestLogger(mockReq('POST', '/timed'), res, vi.fn() as unknown as NextFunction);
    triggerFinish();
    expect(infoSpy.mock.calls[0][0]).toMatch(/\d+ms/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// globalErrorHandler
// ──────────────────────────────────────────────────────────────────────────────

describe('globalErrorHandler', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  function makeRes(headersSent = false) {
    const statusMock = vi.fn().mockReturnThis();
    const jsonMock = vi.fn();
    return {
      res: { headersSent, status: statusMock, json: jsonMock } as unknown as Response,
      statusMock,
      jsonMock,
    };
  }

  it("log méthode, chemin et message d'erreur", () => {
    const { res } = makeRes();
    globalErrorHandler(
      new Error('boom'),
      mockReq('DELETE', '/items/1'),
      res,
      vi.fn() as unknown as NextFunction,
    );
    expect(errorSpy).toHaveBeenCalledOnce();
    const msg = errorSpy.mock.calls[0][0] as string;
    expect(msg).toContain('DELETE /items/1 500');
    expect(msg).toContain('boom');
  });

  it('répond 500 JSON quand les headers ne sont pas encore envoyés', () => {
    const { res, statusMock, jsonMock } = makeRes(false);
    globalErrorHandler(new Error('oops'), mockReq(), res, vi.fn() as unknown as NextFunction);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Erreur interne du serveur.' });
  });

  it('ne répond pas quand headersSent=true', () => {
    const { res, statusMock, jsonMock } = makeRes(true);
    globalErrorHandler(new Error('late'), mockReq(), res, vi.fn() as unknown as NextFunction);
    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
  });

  it('gère une valeur non-Error (string)', () => {
    const { res } = makeRes();
    globalErrorHandler(
      'raw string',
      mockReq('GET', '/foo'),
      res,
      vi.fn() as unknown as NextFunction,
    );
    expect(errorSpy.mock.calls[0][0]).toContain('raw string');
  });
});
