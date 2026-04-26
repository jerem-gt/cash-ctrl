import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

const COLORS = {
  RESET: '\x1b[0m',
  GRAY: '\x1b[90m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
} as const;

const LOG_CONFIG = {
  DEBUG: { priority: 0, color: COLORS.GRAY },
  INFO: { priority: 1, color: COLORS.GREEN },
  WARN: { priority: 2, color: COLORS.YELLOW },
  ERROR: { priority: 3, color: COLORS.RED },
} as const;
type Level = keyof typeof LOG_CONFIG;

const IS_SILENT = process.env.NODE_ENV === 'test';
const CURRENT_LOG_LEVEL = (
  LOG_CONFIG[process.env.LOG_LEVEL as keyof typeof LOG_CONFIG] ?? LOG_CONFIG.INFO
).priority;

function timestamp(): string {
  return new Date().toLocaleString('sv-SE');
}

function log(level: Level, msg: string) {
  const { priority, color } = LOG_CONFIG[level];
  if (IS_SILENT || priority < CURRENT_LOG_LEVEL) {
    return;
  }
  process.stdout.write(
    `${COLORS.GRAY}${timestamp()}${COLORS.RESET.padEnd(5)} ${color}${level}${COLORS.RESET}  ${msg}\n`,
  );
}

export const logger = {
  debug: (msg: string): void => log('DEBUG', msg),
  info: (msg: string): void => log('INFO', msg),
  warn: (msg: string): void => log('WARN', msg),
  error: (msg: string): void => log('ERROR', msg),
};

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const { statusCode } = res;
    const ms = Date.now() - start;
    const line = `${req.method} ${req.path} ${statusCode} - ${ms}ms`;

    if (statusCode >= 500) {
      logger.error(line);
    } else if (statusCode >= 400) {
      logger.warn(line);
    } else if (req.method === 'GET') {
      logger.debug(line);
    } else {
      // On log les succès en INFO uniquement pour les écritures (POST, PUT, DELETE...)
      logger.info(line);
    }
  });
  next();
}

// 4 params requis pour qu'Express reconnaisse le gestionnaire d'erreur (fn.length === 4)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const globalErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`${req.method} ${req.path} 500 — ${message}`);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};
