import type { Database } from 'better-sqlite3';

import { createSettingsRepo } from '../settings/settings.repo';
import { computeInsuranceProfitability } from './insurance-profitability.repo';
import { computeInvestmentProfitability } from './investment-profitability.repo';
import { computeSavingsProfitability } from './savings-profitability.repo';

export function createProfitabilityRepo(db: Database) {
  return {
    getProfitability(userId: number) {
      const currentYear = new Date().getUTCFullYear();
      const todayStr = new Date().toISOString().slice(0, 10);
      const settings = createSettingsRepo(db).get(userId);
      const financialIncomeCategoryId = settings.financial_income_category_id ?? -1;
      return [
        ...computeInvestmentProfitability(
          db,
          userId,
          currentYear,
          todayStr,
          financialIncomeCategoryId,
        ),
        ...computeInsuranceProfitability(db, userId, currentYear, todayStr),
        ...computeSavingsProfitability(
          db,
          userId,
          currentYear,
          todayStr,
          financialIncomeCategoryId,
        ),
      ];
    },
  };
}
