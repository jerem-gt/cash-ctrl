import type { Database } from 'better-sqlite3';

import { seedAccountTypes } from './seeds/accountTypes.seed';
import { seedBanks } from './seeds/banks.seed';
import { seedCategories } from './seeds/categories.seed';
import { seedPaymentMethods } from './seeds/paymentMethods.seed';
import { seedAdminUser } from './seeds/users.seed';

export function seedDatabase(db: Database) {
    seedBanks(db);
    seedAccountTypes(db);
    seedCategories(db);
    seedPaymentMethods(db);
    seedAdminUser(db);
}