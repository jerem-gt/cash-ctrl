import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

const isSilent = process.env.NODE_ENV === 'test';

function timestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

export const logger = {
  info: (msg: string): void => {
    if (!isSilent) process.stdout.write(`${timestamp()} INFO  ${msg}\n`);
  },
  warn: (msg: string): void => {
    if (!isSilent) process.stderr.write(`${timestamp()} WARN  ${msg}\n`);
  },
  error: (msg: string): void => {
    if (!isSilent) process.stderr.write(`${timestamp()} ERROR ${msg}\n`);
  },
};

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const { statusCode } = res;
    if (statusCode >= 400) {
      const ms = Date.now() - start;
      const line = `${req.method} ${req.path} ${statusCode} ${ms}ms`;
      if (statusCode >= 500) {
        logger.error(line);
      } else {
        logger.warn(line);
      }
    }
  });
  next();
}

// 4 params requis pour qu'Express reconnaisse le gestionnaire d'erreur (fn.length === 4)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const globalErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  logger.error(`${req.method ?? '?'} ${req.path ?? '?'} 500 — ${message}`);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};
