export type Lang = 'fr' | 'en';

export interface SystemEntityDef {
  code: string;
  entityType: 'category' | 'subcategory' | 'payment_method';
  settingsColumn: SystemRefColumn;
  names: Record<Lang, string>;
}

export const SYSTEM_REF_COLUMNS = [
  'financial_income_category_id',
  'transfer_subcategory_id',
  'transfer_payment_method_id',
  'bank_fees_subcategory_id',
  'social_fees_subcategory_id',
  'prelevement_payment_method_id',
] as const;

export type SystemRefColumn = (typeof SYSTEM_REF_COLUMNS)[number];

export const SYSTEM_ENTITIES: SystemEntityDef[] = [
  {
    code: 'financial_income',
    entityType: 'category',
    settingsColumn: 'financial_income_category_id',
    names: { fr: 'Revenus financiers', en: 'Financial income' },
  },
  {
    code: 'transfer_subcat',
    entityType: 'subcategory',
    settingsColumn: 'transfer_subcategory_id',
    names: { fr: 'Transfert', en: 'Transfer' },
  },
  {
    code: 'transfer_pm',
    entityType: 'payment_method',
    settingsColumn: 'transfer_payment_method_id',
    names: { fr: 'Transfert', en: 'Transfer' },
  },
  {
    code: 'bank_fees',
    entityType: 'subcategory',
    settingsColumn: 'bank_fees_subcategory_id',
    names: { fr: 'Frais bancaires', en: 'Bank fees' },
  },
  {
    code: 'social_fees',
    entityType: 'subcategory',
    settingsColumn: 'social_fees_subcategory_id',
    names: { fr: 'Prélèvements sociaux', en: 'Social charges' },
  },
  {
    code: 'prelevement',
    entityType: 'payment_method',
    settingsColumn: 'prelevement_payment_method_id',
    names: { fr: 'Prélèvement', en: 'Direct debit' },
  },
];
