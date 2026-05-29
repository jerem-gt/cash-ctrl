import type { Database } from 'better-sqlite3';

import type { Lang } from '../../lib/systemEntities';
import { logger } from '../../logger';
import { DEFAULT_CATEGORIES } from './categories.seed';

type SubcategoryDef = {
  code: string;
  fr: string;
  en: string;
};

// Subcategories grouped by their parent category code. Sharing the parent at the
// key level avoids repeating `category_code` on every entry — Sonar was flagging
// the syntactic repetition of the flat shape. Some FR/EN names exist under more
// than one parent on purpose (e.g. "Cadeau" sits in `leisure` as an expense and
// in `misc_income` as a gift received), guarded by UNIQUE (user_id, category_id, name).
export const DEFAULT_SUBCATEGORIES_BY_CATEGORY: Record<string, SubcategoryDef[]> = {
  housing: [
    { code: 'housing_insurance', fr: 'Assurance', en: 'Insurance' },
    { code: 'rent', fr: 'Loyer', en: 'Rent' },
    { code: 'electricity', fr: 'Électricité', en: 'Electricity' },
    { code: 'gas', fr: 'Gaz', en: 'Gas' },
    { code: 'internet', fr: 'Internet', en: 'Internet' },
    { code: 'mobile', fr: 'Mobile', en: 'Mobile' },
    { code: 'furniture', fr: 'Mobilier', en: 'Furniture' },
    { code: 'renovation', fr: 'Travaux', en: 'Renovation' },
    { code: 'water', fr: 'Eau', en: 'Water' },
    { code: 'moving', fr: 'Déménagement', en: 'Moving' },
    { code: 'agency_fees', fr: "Frais d'agence", en: 'Agency fees' },
  ],
  car: [
    { code: 'car_purchase', fr: 'Achat', en: 'Purchase' },
    { code: 'car_admin', fr: 'Administratif', en: 'Administrative' },
    { code: 'car_fine', fr: 'Amende', en: 'Fine' },
    { code: 'car_insurance', fr: 'Assurance', en: 'Insurance' },
    { code: 'car_toll', fr: 'Autoroute', en: 'Toll' },
    { code: 'car_fuel', fr: 'Carburant', en: 'Fuel' },
    { code: 'car_maintenance', fr: 'Entretien', en: 'Maintenance' },
  ],
  transit: [
    { code: 'bus', fr: 'Bus/Tram/Metro', en: 'Bus/Tram/Metro' },
    { code: 'carpool', fr: 'Covoiturage', en: 'Carpool' },
    { code: 'train', fr: 'Train', en: 'Train' },
    { code: 'vtc', fr: 'VTC', en: 'Rideshare' },
  ],
  health: [
    { code: 'hospital', fr: 'Hôpital', en: 'Hospital' },
    { code: 'doctor', fr: 'Médecin', en: 'Doctor' },
    { code: 'pharmacy', fr: 'Pharmacie', en: 'Pharmacy' },
    { code: 'cpam', fr: 'CPAM', en: 'CPAM' },
    { code: 'mutual', fr: 'Mutuelle', en: 'Health insurance' },
  ],
  food: [
    { code: 'supermarket', fr: 'Supermarché', en: 'Supermarket' },
    { code: 'restaurant', fr: 'Restaurant', en: 'Restaurant' },
    { code: 'cafe', fr: 'Café', en: 'Café' },
  ],
  daily_life: [
    { code: 'other_insurance', fr: 'Assurance autre', en: 'Other insurance' },
    { code: 'death_insurance', fr: 'Assurance décès', en: 'Death insurance' },
    { code: 'hairdresser', fr: 'Coiffeur', en: 'Hairdresser' },
    { code: 'mail', fr: 'Courrier', en: 'Mail' },
    { code: 'cash_withdrawal', fr: 'Retrait', en: 'Cash withdrawal' },
    { code: 'clothes', fr: 'Vêtements', en: 'Clothing' },
    { code: 'hotel', fr: 'Hôtel', en: 'Hotel' },
    { code: 'bank_fees', fr: 'Frais bancaires', en: 'Bank fees' },
    { code: 'professional_fees', fr: 'Frais professionnels', en: 'Professional expenses' },
  ],
  leisure: [
    { code: 'gift', fr: 'Cadeau', en: 'Gift' },
    { code: 'holiday_vouchers', fr: 'Chèques vacances', en: 'Holiday vouchers' },
    { code: 'cinema', fr: 'Cinéma', en: 'Cinema' },
    { code: 'cultural', fr: 'Culturel', en: 'Cultural' },
    { code: 'it', fr: 'Informatique', en: 'IT' },
    { code: 'streaming', fr: 'Streaming', en: 'Streaming' },
    { code: 'show', fr: 'Spectacle', en: 'Show' },
    { code: 'sport', fr: 'Sport', en: 'Sport' },
    { code: 'holidays', fr: 'Vacances', en: 'Holidays' },
  ],
  taxes: [
    { code: 'income_tax', fr: 'Impôt sur le revenu', en: 'Income tax' },
    { code: 'property_tax', fr: 'Taxe foncière', en: 'Property tax' },
    { code: 'residence_tax', fr: "Taxe d'habitation", en: 'Residence tax' },
    { code: 'social_fees', fr: 'Prélèvements sociaux', en: 'Social charges' },
  ],
  work_income: [
    { code: 'salary', fr: 'Salaire', en: 'Salary' },
    { code: 'employer_contribution', fr: 'Abondement', en: 'Employer contribution' },
    { code: 'profit_sharing', fr: 'Intéressement', en: 'Profit sharing' },
    { code: 'participation', fr: 'Participation', en: 'Participation' },
    { code: 'expense_reimbursement', fr: 'Remboursement de frais', en: 'Expense reimbursement' },
    { code: 'pension_contribution', fr: 'Cotisation retraite', en: 'Pension contribution' },
    { code: 'cse', fr: 'CSE', en: 'Works council' },
  ],
  social_benefits: [
    { code: 'housing_allowance', fr: 'APL', en: 'Housing allowance' },
    { code: 'unemployment', fr: 'Chômage', en: 'Unemployment' },
  ],
  financial_income: [
    { code: 'interests', fr: 'Intérêts', en: 'Interest' },
    { code: 'unrealized_gain', fr: 'Plus value latente', en: 'Unrealized gain' },
    { code: 'dividend', fr: 'Dividende', en: 'Dividend' },
  ],
  misc_income: [
    { code: 'income_gift', fr: 'Cadeau', en: 'Gift' },
    { code: 'cashback', fr: 'Cashback', en: 'Cashback' },
    { code: 'bonus', fr: 'Prime', en: 'Bonus' },
    { code: 'sale', fr: 'Vente', en: 'Sale' },
    { code: 'misc_other', fr: 'Autre', en: 'Other' },
  ],
  transfer: [{ code: 'transfer_subcat', fr: 'Transfert', en: 'Transfer' }],
  other: [{ code: 'other_subcat', fr: 'Autre', en: 'Other' }],
};

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
    const nameToId = new Map(categories.map((c) => [c.name, c.id]));
    codeToId = new Map<string, number>();
    for (const cat of DEFAULT_CATEGORIES) {
      const id = nameToId.get(cat.names.fr) ?? nameToId.get(cat.names.en);
      if (id !== undefined) {
        codeToId.set(cat.code, id);
      }
    }
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO subcategories (user_id, category_id, name)
    VALUES (?, ?, ?)
  `);
  const findExistingStmt = db.prepare(
    'SELECT id FROM subcategories WHERE user_id = ? AND category_id = ? AND name = ?',
  );

  const subcodeToId = new Map<string, number>();

  db.transaction(() => {
    for (const [categoryCode, subs] of Object.entries(DEFAULT_SUBCATEGORIES_BY_CATEGORY)) {
      const parentId = codeToId.get(categoryCode);
      if (parentId === undefined) {
        logger.warn(
          `Attention : La catégorie parente "${categoryCode}" n'existe pas, ${subs.length} sous-catégorie(s) ignorée(s)`,
        );
        continue;
      }
      for (const sub of subs) {
        const name = sub[lang];
        const result = insertStmt.run(userId, parentId, name);
        let id: number;
        if (result.lastInsertRowid && Number(result.lastInsertRowid) > 0) {
          id = Number(result.lastInsertRowid);
        } else {
          const existing = findExistingStmt.get(userId, parentId, name) as
            | { id: number }
            | undefined;
          id = existing?.id ?? 0;
        }
        if (id > 0) {
          subcodeToId.set(sub.code, id);
        }
      }
    }
  })();

  return subcodeToId;
}
