export interface QifTransaction {
  qifAccountName: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  memo: string | null;
  cleared: boolean;
  isTransfer: boolean;
  transferTarget: string | null;
}

export interface QifParseResult {
  accounts: string[];
  transactions: QifTransaction[];
  uniqueCategories: string[];
  uniqueTransferTargets: string[];
  detectedDateFormat: 'MM/DD' | 'DD/MM' | 'ambiguous';
}

type PartialTx = Partial<Omit<QifTransaction, 'isTransfer' | 'transferTarget'>>;

// ─── Helpers ─────────────────────

function applyTxField(tx: PartialTx, code: string, value: string): void {
  switch (code) {
    case 'D':
      tx.date = value;
      break;
    case 'T':
      tx.amount = Number.parseFloat(value.replace(',', '').replace(' ', ''));
      break;
    case 'P':
      tx.description = value;
      break;
    case 'L':
      tx.category ??= value;
      break;
    case 'M':
      tx.memo = value || null;
      break;
    case 'C':
      tx.cleared = value === 'X' || value === '*';
      break;
  }
}

function finalizeTransaction(tx: PartialTx | null, accountName: string): QifTransaction | null {
  if (tx?.date === undefined || tx?.amount === undefined) return null;
  const category = tx.category ?? '';
  const isTransfer = category.startsWith('[') && category.endsWith(']');
  return {
    qifAccountName: accountName,
    date: tx.date,
    amount: tx.amount,
    description: tx.description ?? '',
    category,
    memo: tx.memo ?? null,
    cleared: tx.cleared ?? false,
    isTransfer,
    transferTarget: isTransfer ? category.slice(1, -1) : null,
  };
}

function buildQifResult(accountsSet: Set<string>, transactions: QifTransaction[]): QifParseResult {
  const allAccounts = [...accountsSet];
  if (allAccounts.length === 0 && transactions.length > 0) allAccounts.push('');

  const uniqueCategories = [
    ...new Set(transactions.flatMap((t) => (!t.isTransfer && t.category ? [t.category] : []))),
  ];
  const uniqueTransferTargets = [
    ...new Set(
      transactions.flatMap((t) => (t.isTransfer && t.transferTarget ? [t.transferTarget] : [])),
    ),
  ];

  return {
    accounts: allAccounts,
    transactions,
    uniqueCategories,
    uniqueTransferTargets,
    detectedDateFormat: detectDateFormat(transactions.map((t) => t.date)),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function parseQif(content: string): QifParseResult {
  const accountsSet = new Set<string>();
  let currentAccountName = '';

  const transactions = content.split('^').reduce<QifTransaction[]>((acc, block) => {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return acc;

    const first = lines[0];

    // Gestion du compte
    if (first === '!Account') {
      currentAccountName = lines.find((l) => l.startsWith('N'))?.slice(1) || currentAccountName;
      accountsSet.add(currentAccountName);
      return acc;
    }

    // Extraction des données (on saute la ligne si elle commence par '!')
    const txData: PartialTx = {};
    lines.forEach((l) => !l.startsWith('!') && applyTxField(txData, l[0], l.slice(1).trim()));

    const tx = finalizeTransaction(txData, currentAccountName);
    return tx ? [...acc, tx] : acc;
  }, []);

  return buildQifResult(accountsSet, transactions);
}

function detectDateFormat(dates: string[]): 'MM/DD' | 'DD/MM' | 'ambiguous' {
  for (const d of dates) {
    const parts = d.split(/[/\-. ]/);
    if (parts.length < 2) continue;
    const a = Number.parseInt(parts[0]);
    const b = Number.parseInt(parts[1]);
    if (a > 12) return 'DD/MM';
    if (b > 12) return 'MM/DD';
  }
  return 'ambiguous';
}

export function parseQifDate(raw: string, format: 'MM/DD' | 'DD/MM'): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.split(/[/\-. ]/);
  if (parts.length < 3) throw new Error(`Date invalide: ${raw}`);
  let day: number, month: number, year: number;
  if (format === 'MM/DD') {
    [month, day, year] = parts.map(Number);
  } else {
    [day, month, year] = parts.map(Number);
  }
  if (year < 100) year += year < 30 ? 2000 : 1900;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function findTransferPeer(
  transactions: QifTransaction[],
  idx: number,
  processed: Set<number>,
): number {
  const tx = transactions[idx];
  for (let i = 0; i < transactions.length; i++) {
    if (i === idx || processed.has(i)) continue;
    const other = transactions[i];
    if (
      other.isTransfer &&
      Math.abs(tx.amount + other.amount) <= 0.005 &&
      tx.date === other.date &&
      tx.transferTarget === other.qifAccountName &&
      other.transferTarget === tx.qifAccountName
    )
      return i;
  }
  return -1;
}
