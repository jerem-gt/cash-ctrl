import type { Database } from 'better-sqlite3';

import { dateStr } from '../../lib/dateUtils.js';
import { createSettingsRepo } from '../settings/settings.repo.js';
import { computeInsuranceProfitability } from './insurance-profitability.repo.js';
import { computeInvestmentProfitability } from './investment-profitability.repo.js';
import { computeSavingsProfitability } from './savings-profitability.repo.js';

export function createProfitabilityRepo(db: Database) {
  return {
    getProfitability(userId: number) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const todayStr = dateStr(now);
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
