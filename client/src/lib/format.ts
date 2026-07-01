import i18n from '@/i18n';

import { parseLocalDate } from './dateUtils';

export function currentLocale(): string {
  if (i18n.language.startsWith('en')) return 'en-GB';
  return 'fr-FR';
}

const nfCache = new Map<string, Intl.NumberFormat>();
const dfCache = new Map<string, Intl.DateTimeFormat>();

function nf(opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = currentLocale();
  const key = `${locale}${JSON.stringify(opts)}`;
  let f = nfCache.get(key);
  if (f === undefined) {
    f = new Intl.NumberFormat(locale, opts);
    nfCache.set(key, f);
  }
  return f;
}

function df(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = currentLocale();
  const key = `${locale}${JSON.stringify(opts)}`;
  let f = dfCache.get(key);
  if (f === undefined) {
    f = new Intl.DateTimeFormat(locale, opts);
    dfCache.set(key, f);
  }
  return f;
}

export const fmtStockPrice = (n: number, currency = 'EUR') =>
  nf({ style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);

export const fmt = (n: number) =>
  nf({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export const fmtCurrency = (n: number, currency = 'EUR') =>
  nf({ style: 'currency', currency }).format(n);

export const fmtDate = (s: string) =>
  df({ day: '2-digit', month: 'short', year: 'numeric' }).format(parseLocalDate(s));

export const fmtDateShort = (s: string) =>
  df({ day: '2-digit', month: 'short' }).format(parseLocalDate(s));

export function fmtMonthShort(d: Date): string {
  return df({ month: 'short' }).format(d).replace('.', '');
}

export function fmtDayNum(d: Date): string {
  return df({ day: '2-digit' }).format(d);
}

export function monthLabel(offset: number): string {
  const d = new Date();
  // Se caler sur le 1er du mois avant de soustraire : sinon, un jour courant
  // absent du mois cible (ex. 31 mars - 1 mois) fait "déborder" Date sur le
  // mois suivant au lieu du mois voulu.
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return df({ month: 'short' }).format(d);
}
