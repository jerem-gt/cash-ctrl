/**
 * Erreurs HTTP typées levées par les repos/services et traduites en code de
 * réponse par le `globalErrorHandler` (ou par les catch locaux des routes).
 * Évite de déduire le statut HTTP à partir du contenu du message d'erreur.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 — requête invalide (règle métier non respectée, montant négatif, etc.). */
export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

/** 404 — ressource introuvable. */
export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}

/** 409 — conflit (doublon, contrainte, ressource déjà liée…). */
export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message);
  }
}
