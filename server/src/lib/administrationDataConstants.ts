import { Database } from 'better-sqlite3';

import { createSettingsRepo } from '../modules/settings/settings.repo';

export function getTransferIds(db: Database, userId: number) {
  const settings = createSettingsRepo(db).get(userId);
  return {
    subcategoryId: settings.transfer_subcategory_id ?? undefined,
    paymentMethodId: settings.transfer_payment_method_id ?? undefined,
  };
}

export function getBankFeesSubcategoryId(db: Database, userId: number): number | undefined {
  const settings = createSettingsRepo(db).get(userId);
  return settings.bank_fees_subcategory_id ?? undefined;
}

export function getSocialFeesSubcategoryId(db: Database, userId: number): number | undefined {
  const settings = createSettingsRepo(db).get(userId);
  return settings.social_fees_subcategory_id ?? undefined;
}

export function getPrelevementPaymentMethodId(db: Database, userId: number): number | undefined {
  const settings = createSettingsRepo(db).get(userId);
  return settings.prelevement_payment_method_id ?? undefined;
}

export function getAccountTypeIds(db: Database, userId: number) {
  const atPret = db
    .prepare(`SELECT id FROM account_types WHERE envelope_type = 'loan' AND user_id = ?`)
    .get(userId) as { id: number } | undefined;
  return { atPretId: atPret?.id ?? undefined };
}
