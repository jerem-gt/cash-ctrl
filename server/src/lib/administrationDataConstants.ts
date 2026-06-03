import { Database } from 'better-sqlite3';

import { createSettingsRepo } from '../modules/settings/settings.repo';

/** Références « système » de l'utilisateur, lues en une seule passe sur user_settings. */
export interface SystemRefs {
  financialIncomeCategoryId: number | null;
  transferSubcategoryId: number | null;
  transferPaymentMethodId: number | null;
  bankFeesSubcategoryId: number | null;
  socialFeesSubcategoryId: number | null;
  prelevementPaymentMethodId: number | null;
}

/**
 * Lit en une seule requête toutes les références système rattachées aux réglages.
 * À privilégier quand plusieurs ids sont nécessaires dans une même opération
 * (ex. frais = sous-catégorie + moyen de paiement) pour éviter les relectures.
 */
export function getSystemRefs(db: Database, userId: number): SystemRefs {
  const s = createSettingsRepo(db).get(userId);
  return {
    financialIncomeCategoryId: s.financial_income_category_id,
    transferSubcategoryId: s.transfer_subcategory_id,
    transferPaymentMethodId: s.transfer_payment_method_id,
    bankFeesSubcategoryId: s.bank_fees_subcategory_id,
    socialFeesSubcategoryId: s.social_fees_subcategory_id,
    prelevementPaymentMethodId: s.prelevement_payment_method_id,
  };
}

export function getTransferIds(db: Database, userId: number) {
  const refs = getSystemRefs(db, userId);
  return {
    subcategoryId: refs.transferSubcategoryId ?? undefined,
    paymentMethodId: refs.transferPaymentMethodId ?? undefined,
  };
}

export function getBankFeesSubcategoryId(db: Database, userId: number): number | undefined {
  return getSystemRefs(db, userId).bankFeesSubcategoryId ?? undefined;
}

export function getSocialFeesSubcategoryId(db: Database, userId: number): number | undefined {
  return getSystemRefs(db, userId).socialFeesSubcategoryId ?? undefined;
}

export function getPrelevementPaymentMethodId(db: Database, userId: number): number | undefined {
  return getSystemRefs(db, userId).prelevementPaymentMethodId ?? undefined;
}

export function getAccountTypeIds(db: Database, userId: number) {
  const atPret = db
    .prepare(`SELECT id FROM account_types WHERE envelope_type = 'loan' AND user_id = ?`)
    .get(userId) as { id: number } | undefined;
  return { atPretId: atPret?.id ?? undefined };
}
