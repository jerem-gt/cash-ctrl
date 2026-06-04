import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { sessionUserId } from '../middleware';
import {
  type ApiErrorField,
  buildError,
  type ErrorCode,
  type ErrorParams,
  renderMessage,
} from './errorCodes';

/** Envoie une erreur structurée `{ error: { code, message, params? } }`. */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  params?: ErrorParams,
): void {
  res.status(status).json({ error: buildError(code, params) });
}

/** Mappe une issue Zod vers un code de validation traduisible + ses paramètres. */
function classifyIssue(issue: z.core.$ZodIssue): { code: ErrorCode; params?: ErrorParams } {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined
        ? { code: 'validation.required' }
        : { code: 'validation.invalid_type' };
    case 'too_small': {
      const minimum = Number(issue.minimum);
      return issue.origin === 'string' || issue.origin === 'array'
        ? { code: 'validation.too_short', params: { minimum } }
        : { code: 'validation.too_small', params: { minimum } };
    }
    case 'too_big': {
      const maximum = Number(issue.maximum);
      return issue.origin === 'string' || issue.origin === 'array'
        ? { code: 'validation.too_long', params: { maximum } }
        : { code: 'validation.too_big', params: { maximum } };
    }
    case 'invalid_format':
      return { code: 'validation.invalid_format' };
    case 'invalid_value':
      return { code: 'validation.invalid_value' };
    default:
      return { code: 'validation.invalid' };
  }
}

function mapZodIssue(issue: z.core.$ZodIssue): ApiErrorField {
  const path = issue.path.map(String).join('.') || '(root)';
  const { code, params } = classifyIssue(issue);
  return { path, code, params, message: renderMessage(code, params) };
}

/** Construit le corps d'erreur de validation (code générique + détail par champ). */
export function zodToApiError(error: z.ZodError) {
  return {
    code: 'validation.invalid' as const,
    message: renderMessage('validation.invalid'),
    fields: error.issues.map(mapZodIssue),
  };
}

/**
 * Parse un paramètre de route numérique (radix 10). Répond 400 et renvoie null
 * si la valeur n'est pas un entier valide. À utiliser avec `if (value === null) return;`.
 */
export function parseNumberParam(req: Request, res: Response, paramName = 'id'): number | null {
  const value = Number.parseInt(req.params[paramName] as string, 10);
  if (Number.isNaN(value)) {
    sendError(res, 400, 'common.invalid_param', { param: paramName });
    return null;
  }
  return value;
}

export function makeCheckAccount(
  belongsToUser: (accountId: number, userId: number) => boolean,
): RequestHandler {
  return (req, res, next) => {
    const accountId = Number.parseInt(req.params.accountId as string, 10);
    const userId = sessionUserId(req);
    if (!belongsToUser(accountId, userId)) {
      sendError(res, 403, 'account.not_found');
      return;
    }
    res.locals.accountId = accountId;
    res.locals.userId = userId;
    next();
  };
}

export function requireById<T>(
  res: Response,
  repo: { getById: (id: number) => T | null | undefined },
  id: number,
  notFoundCode: ErrorCode,
): boolean {
  if (!repo.getById(id)) {
    sendError(res, 404, notFoundCode);
    return false;
  }
  return true;
}

export function parseBody<T>(res: Response, schema: z.ZodType<T>, body: unknown): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: zodToApiError(parsed.error) });
    return null;
  }
  return parsed.data;
}
