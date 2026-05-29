import type { Database } from 'better-sqlite3';

import type { Lang, SystemRefColumn } from '../lib/systemEntities';
import { SYSTEM_ENTITIES_BY_TYPE } from '../lib/systemEntities';
import { createSettingsRepo } from '../modules/settings/settings.repo';
import { seedAccountTypes } from './seeds/accountTypes.seed';
import { seedBanks } from './seeds/banks.seed';
import { seedCategories } from './seeds/categories.seed';
import { seedPaymentMethods } from './seeds/paymentMethods.seed';
import { seedSubcategories } from './seeds/subcategories.seed';
import { seedTaxData } from './seeds/tax.seed';
import { seedAdminUser } from './seeds/users.seed';

export function seedUserData(db: Database, userId: number, lang: Lang = 'fr') {
  seedAccountTypes(db, userId, lang);
  const categoryCodeToId = seedCategories(db, userId, lang);
  const subcodeToId = seedSubcategories(db, userId, lang, categoryCodeToId);
  const pmCodeToId = seedPaymentMethods(db, userId, lang);

  // Populate system refs in user_settings
  const refs: Partial<Record<SystemRefColumn, number | null>> = {};
  for (const entity of SYSTEM_ENTITIES_BY_TYPE.category) {
    refs[entity.settingsColumn] = categoryCodeToId.get(entity.code) ?? null;
  }
  for (const entity of SYSTEM_ENTITIES_BY_TYPE.subcategory) {
    refs[entity.settingsColumn] = subcodeToId.get(entity.code) ?? null;
  }
  for (const entity of SYSTEM_ENTITIES_BY_TYPE.payment_method) {
    refs[entity.settingsColumn] = pmCodeToId.get(entity.code) ?? null;
  }

  const settingsRepo = createSettingsRepo(db);
  settingsRepo.setSystemRefs(userId, refs);
}

export function seedDatabase(db: Database) {
  seedBanks(db);
  seedAdminUser(db);
  seedTaxData(db);
}
