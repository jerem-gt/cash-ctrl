import type { Database } from 'better-sqlite3';

import { seedAccountTypes } from './seeds/accountTypes.seed';
import { seedBanks } from './seeds/banks.seed';
import { seedCategories } from './seeds/categories.seed';
import { seedPaymentMethods } from './seeds/paymentMethods.seed';
import { seedSubcategories } from './seeds/subcategories.seed';
import { seedTaxData } from './seeds/tax.seed';
import { seedAdminUser } from './seeds/users.seed';

export function seedUserData(db: Database, userId: number) {
  seedAccountTypes(db, userId);
  seedCategories(db, userId);
  seedSubcategories(db, userId);
  seedPaymentMethods(db, userId);
}

export function seedDatabase(db: Database) {
  seedBanks(db);
  seedAdminUser(db);
  seedTaxData(db);
  const admin = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number } | undefined;
  if (admin) seedUserData(db, admin.id);
}
