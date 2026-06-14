export interface ParsedTransaction {
  accountName: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  memo: string | null;
  cleared: boolean;
  isTransfer: boolean;
  transferTarget: string | null;
}

export interface ParsedLedger {
  accounts: string[];
  transactions: ParsedTransaction[];
  uniqueCategories: string[];
  uniqueTransferTargets: string[];
  detectedDateFormat: 'MM/DD' | 'DD/MM' | 'YYYY-MM-DD' | 'ambiguous';
}

// ─── Date helpers (partagés entre QIF et CSV) ─────────────────────────────────

export function detectDateFormat(dates: string[]): 'MM/DD' | 'DD/MM' | 'YYYY-MM-DD' | 'ambiguous' {
  for (const d of dates) {
    const parts = d.split(/[/\-. ]/);
    if (parts.length < 3) continue;
    const a = Number.parseInt(parts[0]);
    if (a > 31) return 'YYYY-MM-DD';
    const b = Number.parseInt(parts[1]);
    if (a > 12) return 'DD/MM';
    if (b > 12) return 'MM/DD';
  }
  return 'ambiguous';
}

export function parseLedgerDate(raw: string, format: 'MM/DD' | 'DD/MM' | 'YYYY-MM-DD'): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.split(/[/\-. ]/);
  if (parts.length < 3) throw new Error(`Date invalide: ${raw}`);
  let day: number, month: number, year: number;
  if (format === 'YYYY-MM-DD') {
    [year, month, day] = parts.map(Number);
  } else if (format === 'MM/DD') {
    [month, day, year] = parts.map(Number);
  } else {
    [day, month, year] = parts.map(Number);
  }
  if (year < 100) year += year < 30 ? 2000 : 1900;
  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(`Date invalide: ${raw}`);
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
