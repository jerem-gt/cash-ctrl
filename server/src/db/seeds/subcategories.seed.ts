import type { Database } from 'better-sqlite3';

import type { Lang } from '../../lib/systemEntities';
import { logger } from '../../logger';
import { DEFAULT_CATEGORIES } from './categories.seed';

type SubcategoryDef = {
  code: string;
  names: { fr: string; en: string };
  category_code: string;
};

export const DEFAULT_SUBCATEGORIES: SubcategoryDef[] = [
  {
    code: 'housing_insurance',
    names: { fr: 'Assurance', en: 'Insurance' },
    category_code: 'housing',
  },
  { code: 'rent', names: { fr: 'Loyer', en: 'Rent' }, category_code: 'housing' },
  {
    code: 'electricity',
    names: { fr: 'Électricité', en: 'Electricity' },
    category_code: 'housing',
  },
  { code: 'gas', names: { fr: 'Gaz', en: 'Gas' }, category_code: 'housing' },
  { code: 'internet', names: { fr: 'Internet', en: 'Internet' }, category_code: 'housing' },
  { code: 'mobile', names: { fr: 'Mobile', en: 'Mobile' }, category_code: 'housing' },
  { code: 'furniture', names: { fr: 'Mobilier', en: 'Furniture' }, category_code: 'housing' },
  { code: 'renovation', names: { fr: 'Travaux', en: 'Renovation' }, category_code: 'housing' },
  { code: 'water', names: { fr: 'Eau', en: 'Water' }, category_code: 'housing' },
  { code: 'moving', names: { fr: 'Déménagement', en: 'Moving' }, category_code: 'housing' },
  {
    code: 'agency_fees',
    names: { fr: "Frais d'agence", en: 'Agency fees' },
    category_code: 'housing',
  },

  { code: 'car_purchase', names: { fr: 'Achat', en: 'Purchase' }, category_code: 'car' },
  { code: 'car_admin', names: { fr: 'Administratif', en: 'Administrative' }, category_code: 'car' },
  { code: 'car_fine', names: { fr: 'Amende', en: 'Fine' }, category_code: 'car' },
  { code: 'car_insurance', names: { fr: 'Assurance', en: 'Insurance' }, category_code: 'car' },
  { code: 'car_toll', names: { fr: 'Autoroute', en: 'Toll' }, category_code: 'car' },
  { code: 'car_fuel', names: { fr: 'Carburant', en: 'Fuel' }, category_code: 'car' },
  { code: 'car_maintenance', names: { fr: 'Entretien', en: 'Maintenance' }, category_code: 'car' },

  { code: 'bus', names: { fr: 'Bus/Tram/Metro', en: 'Bus/Tram/Metro' }, category_code: 'transit' },
  { code: 'carpool', names: { fr: 'Covoiturage', en: 'Carpool' }, category_code: 'transit' },
  { code: 'train', names: { fr: 'Train', en: 'Train' }, category_code: 'transit' },
  { code: 'vtc', names: { fr: 'VTC', en: 'Rideshare' }, category_code: 'transit' },

  { code: 'hospital', names: { fr: 'Hôpital', en: 'Hospital' }, category_code: 'health' },
  { code: 'doctor', names: { fr: 'Médecin', en: 'Doctor' }, category_code: 'health' },
  { code: 'pharmacy', names: { fr: 'Pharmacie', en: 'Pharmacy' }, category_code: 'health' },
  { code: 'cpam', names: { fr: 'CPAM', en: 'CPAM' }, category_code: 'health' },
  { code: 'mutual', names: { fr: 'Mutuelle', en: 'Health insurance' }, category_code: 'health' },

  { code: 'supermarket', names: { fr: 'Supermarché', en: 'Supermarket' }, category_code: 'food' },
  { code: 'restaurant', names: { fr: 'Restaurant', en: 'Restaurant' }, category_code: 'food' },
  { code: 'cafe', names: { fr: 'Café', en: 'Café' }, category_code: 'food' },

  {
    code: 'other_insurance',
    names: { fr: 'Assurance autre', en: 'Other insurance' },
    category_code: 'daily_life',
  },
  {
    code: 'death_insurance',
    names: { fr: 'Assurance décès', en: 'Death insurance' },
    category_code: 'daily_life',
  },
  {
    code: 'hairdresser',
    names: { fr: 'Coiffeur', en: 'Hairdresser' },
    category_code: 'daily_life',
  },
  { code: 'mail', names: { fr: 'Courrier', en: 'Mail' }, category_code: 'daily_life' },
  {
    code: 'cash_withdrawal',
    names: { fr: 'Retrait', en: 'Cash withdrawal' },
    category_code: 'daily_life',
  },
  { code: 'clothes', names: { fr: 'Vêtements', en: 'Clothing' }, category_code: 'daily_life' },
  { code: 'hotel', names: { fr: 'Hôtel', en: 'Hotel' }, category_code: 'daily_life' },
  {
    code: 'bank_fees',
    names: { fr: 'Frais bancaires', en: 'Bank fees' },
    category_code: 'daily_life',
  },
  {
    code: 'professional_fees',
    names: { fr: 'Frais professionnels', en: 'Professional expenses' },
    category_code: 'daily_life',
  },

  { code: 'gift', names: { fr: 'Cadeau', en: 'Gift' }, category_code: 'leisure' },
  {
    code: 'holiday_vouchers',
    names: { fr: 'Chèques vacances', en: 'Holiday vouchers' },
    category_code: 'leisure',
  },
  { code: 'cinema', names: { fr: 'Cinéma', en: 'Cinema' }, category_code: 'leisure' },
  { code: 'cultural', names: { fr: 'Culturel', en: 'Cultural' }, category_code: 'leisure' },
  { code: 'it', names: { fr: 'Informatique', en: 'IT' }, category_code: 'leisure' },
  { code: 'streaming', names: { fr: 'Streaming', en: 'Streaming' }, category_code: 'leisure' },
  { code: 'show', names: { fr: 'Spectacle', en: 'Show' }, category_code: 'leisure' },
  { code: 'sport', names: { fr: 'Sport', en: 'Sport' }, category_code: 'leisure' },
  { code: 'holidays', names: { fr: 'Vacances', en: 'Holidays' }, category_code: 'leisure' },

  {
    code: 'income_tax',
    names: { fr: 'Impôt sur le revenu', en: 'Income tax' },
    category_code: 'taxes',
  },
  {
    code: 'property_tax',
    names: { fr: 'Taxe foncière', en: 'Property tax' },
    category_code: 'taxes',
  },
  {
    code: 'residence_tax',
    names: { fr: "Taxe d'habitation", en: 'Residence tax' },
    category_code: 'taxes',
  },
  {
    code: 'social_fees',
    names: { fr: 'Prélèvements sociaux', en: 'Social charges' },
    category_code: 'taxes',
  },

  { code: 'salary', names: { fr: 'Salaire', en: 'Salary' }, category_code: 'work_income' },
  {
    code: 'employer_contribution',
    names: { fr: 'Abondement', en: 'Employer contribution' },
    category_code: 'work_income',
  },
  {
    code: 'profit_sharing',
    names: { fr: 'Intéressement', en: 'Profit sharing' },
    category_code: 'work_income',
  },
  {
    code: 'participation',
    names: { fr: 'Participation', en: 'Participation' },
    category_code: 'work_income',
  },
  {
    code: 'expense_reimbursement',
    names: { fr: 'Remboursement de frais', en: 'Expense reimbursement' },
    category_code: 'work_income',
  },
  {
    code: 'pension_contribution',
    names: { fr: 'Cotisation retraite', en: 'Pension contribution' },
    category_code: 'work_income',
  },
  { code: 'cse', names: { fr: 'CSE', en: 'Works council' }, category_code: 'work_income' },

  {
    code: 'housing_allowance',
    names: { fr: 'APL', en: 'Housing allowance' },
    category_code: 'social_benefits',
  },
  {
    code: 'unemployment',
    names: { fr: 'Chômage', en: 'Unemployment' },
    category_code: 'social_benefits',
  },

  {
    code: 'interests',
    names: { fr: 'Intérêts', en: 'Interest' },
    category_code: 'financial_income',
  },
  {
    code: 'unrealized_gain',
    names: { fr: 'Plus value latente', en: 'Unrealized gain' },
    category_code: 'financial_income',
  },
  {
    code: 'dividend',
    names: { fr: 'Dividende', en: 'Dividend' },
    category_code: 'financial_income',
  },

  { code: 'income_gift', names: { fr: 'Cadeau', en: 'Gift' }, category_code: 'misc_income' },
  { code: 'cashback', names: { fr: 'Cashback', en: 'Cashback' }, category_code: 'misc_income' },
  { code: 'bonus', names: { fr: 'Prime', en: 'Bonus' }, category_code: 'misc_income' },
  { code: 'sale', names: { fr: 'Vente', en: 'Sale' }, category_code: 'misc_income' },
  { code: 'misc_other', names: { fr: 'Autre', en: 'Other' }, category_code: 'misc_income' },

  {
    code: 'transfer_subcat',
    names: { fr: 'Transfert', en: 'Transfer' },
    category_code: 'transfer',
  },

  { code: 'other_subcat', names: { fr: 'Autre', en: 'Other' }, category_code: 'other' },
];

export function seedSubcategories(
  db: Database,
  userId: number,
  lang: Lang = 'fr',
  categoryCodeToId?: Map<string, number>,
): Map<string, number> {
  let codeToId = categoryCodeToId;
  if (!codeToId) {
    const categories = db
      .prepare('SELECT id, name FROM categories WHERE user_id = ?')
      .all(userId) as { id: number; name: string }[];
    // Build a temporary map from name to id
    const nameToId = new Map(categories.map((c) => [c.name, c.id]));
    // Build code→id by matching known FR/EN names from DEFAULT_CATEGORIES
    codeToId = new Map<string, number>();
    for (const cat of DEFAULT_CATEGORIES) {
      const id = nameToId.get(cat.names.fr) ?? nameToId.get(cat.names.en);
      if (id !== undefined) {
        codeToId.set(cat.code, id);
      }
    }
  }

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO subcategories (user_id, category_id, name)
    VALUES (?, ?, ?)
  `);

  const subcodeToId = new Map<string, number>();

  db.transaction(() => {
    for (const sub of DEFAULT_SUBCATEGORIES) {
      const parentId = codeToId.get(sub.category_code);

      if (parentId !== undefined) {
        const name = sub.names[lang];
        const result = stmt.run(userId, parentId, name);
        let id: number;
        if (result.lastInsertRowid && Number(result.lastInsertRowid) > 0) {
          id = Number(result.lastInsertRowid);
        } else {
          const existing = db
            .prepare(
              'SELECT id FROM subcategories WHERE user_id = ? AND category_id = ? AND name = ?',
            )
            .get(userId, parentId, name) as { id: number } | undefined;
          id = existing?.id ?? 0;
        }
        if (id > 0) {
          subcodeToId.set(sub.code, id);
        }
      } else {
        logger.warn(
          `Attention : La catégorie parente "${sub.category_code}" n'existe pas pour la sous-catégorie "${sub.names[lang]}"`,
        );
      }
    }
  })();

  return subcodeToId;
}
