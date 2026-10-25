import { type Filters, NO_CATEGORY, type TransactionType } from '@cashctrl/types';

import { formatLocalDate } from '@/lib/dateUtils';

import { buildTransactionsUrl } from './filtersUrl';

export interface DateRange {
  date_from: string;
  date_to: string;
}

export function monthRange(now: Date = new Date()): DateRange {
  return {
    date_from: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    date_to: formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function yearRange(year: number): DateRange {
  return { date_from: `${year}-01-01`, date_to: `${year}-12-31` };
}

// Les stats excluent les virements et ne comptent que les validées : les liens en reprennent le périmètre.
export function statsTransactionsUrl(filters: Filters): string {
  return buildTransactionsUrl({ ...filters, validated: true, exclude_transfers: true });
}

interface CategoryUrlOptions {
  type: TransactionType;
  categoryId: number | null;
  range: DateRange;
  accountId?: number;
}

export function categoryTransactionsUrl({
  type,
  categoryId,
  range,
  accountId,
}: CategoryUrlOptions): string {
  return statsTransactionsUrl({
    ...range,
    type,
    category_id: categoryId ?? NO_CATEGORY,
    account_id: accountId,
  });
}
