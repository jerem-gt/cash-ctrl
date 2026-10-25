import type { Filters } from '@cashctrl/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INT_RE = /^\d+$/;
const NO_CATEGORY = 'none';

type IdKey = 'account_id' | 'category_id' | 'subcategory_id' | 'payment_method_id';
type DateKey = 'date_from' | 'date_to';
type AmountKey = 'amount_min' | 'amount_max';

const ID_KEYS: IdKey[] = ['account_id', 'category_id', 'subcategory_id', 'payment_method_id'];
const DATE_KEYS: DateKey[] = ['date_from', 'date_to'];
const AMOUNT_KEYS: AmountKey[] = ['amount_min', 'amount_max'];

function parsePositiveInt(value: string | null): number | undefined {
  if (value === null || !INT_RE.test(value)) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

function parseAmount(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseValidated(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseRangeFilters(params: URLSearchParams, filters: Filters): void {
  for (const key of DATE_KEYS) {
    const date = params.get(key);
    if (date !== null && DATE_RE.test(date)) filters[key] = date;
  }
  for (const key of AMOUNT_KEYS) {
    const amount = parseAmount(params.get(key));
    if (amount !== undefined) filters[key] = amount;
  }
}

export function parseTxSearch(params: URLSearchParams): { filters: Filters; page: number } {
  const filters: Filters = {};

  const q = params.get('q')?.trim();
  if (q) filters.description_contains = q;

  const type = params.get('type');
  if (type === 'income' || type === 'expense') filters.type = type;

  for (const key of ID_KEYS) {
    const id = parsePositiveInt(params.get(key));
    if (id !== undefined) filters[key] = id;
  }
  if (params.get('category_id') === NO_CATEGORY) filters.category_id = NO_CATEGORY;
  // Une sous-catégorie n'a de sens qu'avec une catégorie réelle.
  if (typeof filters.category_id !== 'number') delete filters.subcategory_id;

  parseRangeFilters(params, filters);

  const validated = parseValidated(params.get('validated'));
  if (validated !== undefined) filters.validated = validated;

  if (params.get('exclude_transfers') === 'true') filters.exclude_transfers = true;

  const page = parsePositiveInt(params.get('page')) ?? 1;
  return { filters, page };
}

export function toTxSearch(filters: Filters, page: number): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.description_contains?.trim();
  if (q) params.set('q', q);
  if (filters.type) params.set('type', filters.type);
  for (const key of ID_KEYS) {
    const id = filters[key];
    if (id !== undefined) params.set(key, String(id));
  }
  for (const key of DATE_KEYS) {
    const date = filters[key];
    if (date) params.set(key, date);
  }
  for (const key of AMOUNT_KEYS) {
    const amount = filters[key];
    if (amount !== undefined) params.set(key, String(amount));
  }
  if (filters.validated !== undefined) params.set('validated', String(filters.validated));
  if (filters.exclude_transfers) params.set('exclude_transfers', 'true');
  if (page > 1) params.set('page', String(page));
  return params;
}

export function buildTransactionsUrl(filters: Filters): string {
  const search = toTxSearch(filters, 1).toString();
  return search ? `/transactions?${search}` : '/transactions';
}
