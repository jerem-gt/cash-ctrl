import { type ErrorCode, type ErrorParams, renderMessage } from './errorCodes';

/**
 * Erreurs HTTP typées levées par les repos/services et traduites en réponse par
 * le `globalErrorHandler` (ou par les catch locaux des routes). Portent un `code`
 * d'erreur stable (cf. errorCodes.ts) + des paramètres d'interpolation optionnels ;
 * le message FR dérivé sert de repli lisible.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly params?: ErrorParams,
  ) {
    super(renderMessage(code, params));
    this.name = new.target.name;
  }
}

/** 400 — requête invalide (règle métier non respectée, montant négatif, etc.). */
export class BadRequestError extends HttpError {
  constructor(code: ErrorCode, params?: ErrorParams) {
    super(400, code, params);
  }
}

/** 404 — ressource introuvable. */
export class NotFoundError extends HttpError {
  constructor(code: ErrorCode, params?: ErrorParams) {
    super(404, code, params);
  }
}

/** 409 — conflit (doublon, contrainte, ressource déjà liée…). */
export class ConflictError extends HttpError {
  constructor(code: ErrorCode, params?: ErrorParams) {
    super(409, code, params);
  }
}
