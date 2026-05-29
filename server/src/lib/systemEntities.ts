export type Lang = 'fr' | 'en';

export type EntityType = 'category' | 'subcategory' | 'payment_method';

export const SYSTEM_REF_COLUMNS = [
  'financial_income_category_id',
  'transfer_subcategory_id',
  'transfer_payment_method_id',
  'bank_fees_subcategory_id',
  'social_fees_subcategory_id',
  'prelevement_payment_method_id',
] as const;

export type SystemRefColumn = (typeof SYSTEM_REF_COLUMNS)[number];

export interface SystemEntityDef {
  code: string;
  settingsColumn: SystemRefColumn;
  // FR/EN names are documentation: the seed inserts via the *.seed.ts catalogs;
  // this file lists what code/column each system entity resolves to per language.
  fr: string;
  en: string;
}

// Grouped by entity type so the seed can dispatch each entry to the right id
// map without an entityType discriminator on every entry.
export const SYSTEM_ENTITIES_BY_TYPE: Record<EntityType, SystemEntityDef[]> = {
  category: [
    {
      code: 'financial_income',
      settingsColumn: 'financial_income_category_id',
      fr: 'Revenus financiers',
      en: 'Financial income',
    },
  ],
  subcategory: [
    {
      code: 'transfer_subcat',
      settingsColumn: 'transfer_subcategory_id',
      fr: 'Transfert',
      en: 'Transfer',
    },
    {
      code: 'bank_fees',
      settingsColumn: 'bank_fees_subcategory_id',
      fr: 'Frais bancaires',
      en: 'Bank fees',
    },
    {
      code: 'social_fees',
      settingsColumn: 'social_fees_subcategory_id',
      fr: 'Prélèvements sociaux',
      en: 'Social charges',
    },
  ],
  payment_method: [
    {
      code: 'transfer_pm',
      settingsColumn: 'transfer_payment_method_id',
      fr: 'Transfert',
      en: 'Transfer',
    },
    {
      code: 'prelevement',
      settingsColumn: 'prelevement_payment_method_id',
      fr: 'Prélèvement',
      en: 'Direct debit',
    },
  ],
};
