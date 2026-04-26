import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

function timestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

export const logger = {
  info: (msg: string): void => {
    process.stdout.write(`${timestamp()} INFO  ${msg}\n`);
  },
  warn: (msg: string): void => {
    process.stderr.write(`${timestamp()} WARN  ${msg}\n`);
  },
  error: (msg: string): void => {
    process.stderr.write(`${timestamp()} ERROR ${msg}\n`);
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

export const globalErrorHandler: ErrorRequestHandler = (err, req, res) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`${req.method} ${req.path} 500 — ${message}`);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};
