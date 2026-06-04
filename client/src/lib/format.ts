import i18n from '@/i18n';

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

export const fmtDec = (n: number) => fmtCurrency(n);

export const fmtDate = (s: string) =>
  df({ day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(s + 'T00:00:00'));

export const fmtDateShort = (s: string) =>
  df({ day: '2-digit', month: 'short' }).format(new Date(s + 'T00:00:00'));

export function fmtMonthShort(d: Date): string {
  return df({ month: 'short' }).format(d).replace('.', '');
}

export function fmtDayNum(d: Date): string {
  return df({ day: '2-digit' }).format(d);
}

export const today = () => new Date().toISOString().split('T')[0];

export function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

export function monthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return df({ month: 'short' }).format(d);
}

export function isSameMonth(dateStr: string, offset: number): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const ref = new Date();
  ref.setMonth(ref.getMonth() - offset);
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}
