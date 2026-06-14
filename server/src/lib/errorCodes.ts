/**
 * Registre unique des codes d'erreur de l'API et de leurs messages FR de repli.
 *
 * Le serveur renvoie `{ error: { code, message, params? } }` : `code` est la clé
 * stable traduite côté client (namespace i18n `errors`), `message` est le rendu FR
 * (repli si une traduction manque, et lisibilité en debug/logs). Les templates
 * utilisent des placeholders `{{param}}` interpolés par `renderMessage`.
 */
export const ERROR_MESSAGES = {
  // ── Communs ───────────────────────────────────────────────────────────────
  'common.unauthorized': 'Non authentifié',
  'common.forbidden': 'Accès refusé',
  'common.invalid_request': 'Requête invalide',
  'common.invalid_param': 'Paramètre {{param}} invalide',
  'common.internal': 'Erreur interne du serveur.',

  // ── Validation (par champ) ────────────────────────────────────────────────
  'validation.invalid': 'Données invalides',
  'validation.required': 'Ce champ est requis',
  'validation.invalid_type': 'Type de valeur incorrect',
  'validation.too_small': 'La valeur doit être au moins {{minimum}}',
  'validation.too_big': 'La valeur ne doit pas dépasser {{maximum}}',
  'validation.too_short': 'Doit contenir au moins {{minimum}} caractère(s)',
  'validation.too_long': 'Doit contenir au plus {{maximum}} caractère(s)',
  'validation.invalid_format': 'Format invalide',
  'validation.invalid_value': 'Valeur non autorisée',

  // ── Comptes ───────────────────────────────────────────────────────────────
  'account.not_found': 'Compte introuvable',
  'account.not_found_or_not_owned': "Compte introuvable ou n'appartenant pas à l'utilisateur",
  'account.already_closed': 'Ce compte est déjà clôturé',
  'account.not_closed': "Ce compte n'est pas clôturé",
  'account.close_requires_zero_or_target':
    'Le solde doit être nul ou un compte de destination est requis',

  // ── Types de compte ───────────────────────────────────────────────────────
  'account_type.not_found': 'Type de compte introuvable',
  'account_type.in_use': 'Ce type est utilisé par {{count}} compte(s).',

  // ── Transactions ──────────────────────────────────────────────────────────
  'transaction.not_found': 'Transaction introuvable',
  'transaction.no_direct_on_av_per':
    'Impossible de créer une transaction directement sur un compte AV/PER',
  'transaction.use_transfers_update': 'Utilisez PUT /api/transfers/:id pour modifier un transfert',
  'transaction.use_transfers_delete':
    'Utilisez DELETE /api/transfers/:id pour supprimer un transfert',
  'transaction.is_stock_fees':
    "Cette transaction correspond aux frais d'une opération boursière. Modifiez l'opération pour changer les frais.",

  // ── Transferts ────────────────────────────────────────────────────────────
  'transfer.same_account': 'Les deux comptes doivent être différents',
  'transfer.not_a_transfer_update':
    "Ce n'est pas un transfert — utilisez PUT /api/transactions/:id",
  'transfer.not_a_transfer_delete':
    "Ce n'est pas un transfert — utilisez DELETE /api/transactions/:id",

  // ── Banques ───────────────────────────────────────────────────────────────
  'bank.not_found': 'Banque introuvable',
  'bank.in_use': 'Cette banque est utilisée par {{count}} compte(s).',
  'bank.no_file': 'Aucun fichier fourni',

  // ── Catégories / sous-catégories / moyens de paiement ─────────────────────
  'category.not_found': 'Catégorie introuvable',
  'category.in_use':
    'Cette catégorie est utilisée par {{count}} transaction(s) et ne peut pas être supprimée.',
  'subcategory.not_found': 'Sous-catégorie introuvable',
  'subcategory.in_use':
    'Cette sous-catégorie est utilisée par {{count}} transaction(s) et ne peut pas être supprimée.',
  'payment_method.not_found': 'Moyen de paiement introuvable',
  'payment_method.in_use':
    'Ce moyen de paiement est utilisé par {{count}} transaction(s) et ne peut pas être supprimé.',

  // ── Utilisateurs ──────────────────────────────────────────────────────────
  'user.not_found': 'Utilisateur introuvable',
  'user.username_taken': "Nom d'utilisateur déjà utilisé",
  'user.cannot_modify_admin': 'Impossible de modifier le compte administrateur',
  'user.cannot_delete_admin': 'Impossible de supprimer le compte administrateur',

  // ── Authentification ──────────────────────────────────────────────────────
  'auth.invalid_credentials': 'Identifiants invalides',
  'auth.too_many_attempts': 'Trop de tentatives. Réessayez plus tard.',
  'auth.password_too_short': 'Le mot de passe doit contenir au moins 8 caractères',
  'auth.current_password_incorrect': 'Mot de passe actuel incorrect',
  'auth.totp_required': "Code d'authentification requis",
  'auth.totp_invalid': 'Code invalide ou expiré',
  'auth.totp_token_invalid': "Session d'authentification expirée, reconnectez-vous",
  'auth.totp_already_enabled': 'La double authentification est déjà activée',
  'auth.totp_not_enabled': "La double authentification n'est pas activée",

  // ── Remboursements ────────────────────────────────────────────────────────
  'reimbursement.only_expense': 'Seules les dépenses peuvent avoir des remboursements',
  'reimbursement.linked_not_found': 'Transaction liée introuvable',
  'reimbursement.linked_must_be_income': 'La transaction liée doit être un revenu',

  // ── Planifications ────────────────────────────────────────────────────────
  'scheduled.not_found': 'Planification introuvable',
  'scheduled.destination_required': 'Un compte destination est requis pour un transfert',
  'scheduled.account_must_be_av_per': 'Le compte doit être une assurance vie ou un PER',
  'scheduled.source_required_versement': 'Un compte source est requis pour un versement planifié',

  // ── Assurance ─────────────────────────────────────────────────────────────
  'insurance.account_not_insurance': "Ce compte n'est pas une enveloppe assurance",
  'insurance.support_not_found': 'Support introuvable',
  'insurance.support_source_not_found': 'Support source introuvable',
  'insurance.support_dest_not_found': 'Support destination introuvable',
  'insurance.support_has_operations': 'Ce support a des opérations enregistrées',
  'insurance.operation_not_found': 'Opération introuvable',
  'insurance.supports_must_differ': 'Les supports source et destination doivent être différents',
  'insurance.interets_euro_only': 'Les intérêts ne concernent que les fonds euro',
  'insurance.revalorisation_uc_only': 'La revalorisation ne concerne que les UC',
  'insurance.arbitrage_not_editable': 'Les arbitrages ne peuvent pas être modifiés',
  'insurance.amount_positive': 'Le montant doit être positif',
  'insurance.net_amount_positive':
    'Le montant net après frais et prélèvements sociaux doit être positif',
  'insurance.insufficient_balance': 'Solde insuffisant : {{balance}} € disponible(s)',
  'insurance.insufficient_balance_support': 'Solde insuffisant sur {{support}} : {{balance}} €',

  // ── Bourse ────────────────────────────────────────────────────────────────
  'stock.operation_not_found': 'Opération introuvable',
  'stock.account_not_investment': "Ce compte n'est pas un compte d'investissement",
  'stock.source_account_not_found': 'Compte source introuvable',
  'stock.dest_account_not_found': 'Compte destination introuvable',
  'stock.source_not_investment': "Le compte source n'est pas un compte d'investissement",
  'stock.dest_not_investment': "Le compte destination n'est pas un compte d'investissement",
  'stock.accounts_must_differ': 'Les comptes source et destination doivent être différents',
  'stock.price_not_found': 'Cotation introuvable pour {{ticker}}',
  'stock.insufficient_position': 'Position insuffisante : {{available}} action(s) disponible(s)',
  'stock.net_amount_after_fees_positive': 'Le montant net après frais doit être positif',
  'stock.net_amount_positive': 'Le montant net doit être positif',

  // ── Prêts ─────────────────────────────────────────────────────────────────
  'loan.not_found': 'Prêt introuvable',
  'loan.installment_not_found': 'Mensualité introuvable',

  // ── Sauvegardes ───────────────────────────────────────────────────────────
  'backup.invalid_filename': 'Nom de fichier invalide',
  'backup.not_found': 'Backup introuvable',

  // ── Fiscalité ─────────────────────────────────────────────────────────────
  'tax.bracket_not_found': 'Barème {{year}} introuvable',

  // ── Réglages ──────────────────────────────────────────────────────────────
  'settings.ref_not_owned': "{{col}} : l'id {{id}} n'appartient pas à cet utilisateur",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;
export type ErrorParams = Record<string, string | number>;

export interface ApiErrorField {
  path: string;
  code: ErrorCode;
  params?: ErrorParams;
  message: string;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  params?: ErrorParams;
  fields?: ApiErrorField[];
}

/** Interpole les placeholders `{{key}}` d'un template avec les params fournis. */
export function renderMessage(code: ErrorCode, params?: ErrorParams): string {
  const template = ERROR_MESSAGES[code];
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`,
  );
}

/** Construit le corps d'erreur structuré renvoyé au client. */
export function buildError(code: ErrorCode, params?: ErrorParams): ApiErrorBody {
  return { code, message: renderMessage(code, params), ...(params ? { params } : {}) };
}
